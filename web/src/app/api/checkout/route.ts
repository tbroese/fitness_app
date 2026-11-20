import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const gymName = String(body.gymName || '').trim();
    const ownerName = String(body.ownerName || '').trim();
    const ownerEmail = String(body.ownerEmail || '').trim().toLowerCase();
    const address = String(body.address || '').trim() || null;
    const city = String(body.city || '').trim() || null;
    const state = String(body.state || '').trim() || null;
    const phone = String(body.phone || '').trim() || null;

    if (!gymName || !ownerName || !ownerEmail) {
      return NextResponse.json(
        { error: 'Gym name, owner name, and owner email are required.' },
        { status: 400 }
      );
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      return NextResponse.json(
        { error: 'Stripe is not configured yet (missing STRIPE_PRICE_ID).' },
        { status: 500 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const applicationId = `papp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const supabaseAdmin = getSupabaseAdmin();
    const { error: insertError } = await supabaseAdmin
      .from('partner_applications')
      .insert({
        id: applicationId,
        gym_name: gymName,
        address,
        city,
        state,
        owner_name: ownerName,
        owner_email: ownerEmail,
        phone,
        payment_status: 'pending',
      });

    if (insertError) {
      console.error('[checkout] Failed to insert partner_applications:', insertError);
      return NextResponse.json(
        { error: 'Could not save application. Please try again.' },
        { status: 500 }
      );
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: ownerEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        applicationId,
        gymName,
        ownerName,
      },
      success_url: `${siteUrl}/partners/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/partners?canceled=1`,
    });

    await supabaseAdmin
      .from('partner_applications')
      .update({
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[checkout] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Unable to create checkout session.' },
      { status: 500 }
    );
  }
}
