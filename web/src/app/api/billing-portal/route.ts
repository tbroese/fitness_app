import { NextRequest, NextResponse } from 'next/server';
import { getStripeClient } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: owner } = await supabaseAdmin
      .from('gym_owners')
      .select('stripe_customer_id')
      .eq('auth_user_id', userData.user.id)
      .single();

    if (!owner?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found for this owner.' },
        { status: 404 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const stripe = getStripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: owner.stripe_customer_id,
      return_url: `${siteUrl}/owner`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error('[billing-portal] Error:', err);
    return NextResponse.json(
      { error: 'Unable to open billing portal.' },
      { status: 500 }
    );
  }
}
