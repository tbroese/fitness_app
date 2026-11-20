import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: 'Missing STRIPE_WEBHOOK_SECRET' },
      { status: 500 }
    );
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const applicationId = session.metadata?.applicationId;
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id || null;

      if (applicationId) {
        const { data: appRow } = await supabaseAdmin
          .from('partner_applications')
          .update({
            payment_status: 'paid',
            stripe_customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', applicationId)
          .select('*')
          .single();

        if (appRow) {
          // Match existing gym in public.gyms by name (if present) and mark is_partnered = true
          let matchedGymId = appRow.gym_id || `partner_${appRow.id}`;
          const { data: matchedGyms } = await supabaseAdmin
            .from('gyms')
            .select('id, name')
            .ilike('name', appRow.gym_name)
            .limit(1);

          if (matchedGyms && matchedGyms.length > 0) {
            matchedGymId = matchedGyms[0].id;
            await supabaseAdmin
              .from('gyms')
              .update({ is_partnered: true })
              .eq('id', matchedGymId);
          }

          // Invite or locate Supabase Auth user for the owner email so they can log into /owner
          const ownerEmail = String(appRow.owner_email).toLowerCase();
          let authUserId: string | null = null;
          const { data: inviteData } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            ownerEmail
          );
          if (inviteData?.user?.id) {
            authUserId = inviteData.user.id;
          } else {
            const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({
              perPage: 200,
            });
            const existingUser = usersPage?.users?.find(
              (u) => u.email?.toLowerCase() === ownerEmail
            );
            authUserId = existingUser?.id || null;
          }

          if (authUserId) {
            await supabaseAdmin.from('gym_owners').upsert(
              {
                id: `owner_${authUserId}`,
                auth_user_id: authUserId,
                email: ownerEmail,
                full_name: appRow.owner_name,
                gym_id: matchedGymId,
                gym_name: appRow.gym_name,
                stripe_customer_id: customerId,
                subscription_status: 'active',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );
          }
        }
      }
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      const status =
        event.type === 'customer.subscription.deleted'
          ? 'canceled'
          : sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
          ? sub.status
          : 'canceled';

      if (customerId) {
        await supabaseAdmin
          .from('gym_owners')
          .update({
            subscription_status: status,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] Handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
