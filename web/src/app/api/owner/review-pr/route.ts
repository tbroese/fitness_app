import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { verificationId, decision, reviewNotes } = await req.json();
    if (
      !verificationId ||
      (decision !== 'approved' && decision !== 'rejected')
    ) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: owner } = await supabaseAdmin
      .from('gym_owners')
      .select('id, gym_id, subscription_status')
      .eq('auth_user_id', userData.user.id)
      .single();

    if (
      !owner ||
      (owner.subscription_status !== 'active' &&
        owner.subscription_status !== 'trialing')
    ) {
      return NextResponse.json(
        { error: 'Active gym owner subscription required.' },
        { status: 403 }
      );
    }

    const { data: prRow } = await supabaseAdmin
      .from('pr_verifications')
      .select('*')
      .eq('id', verificationId)
      .single();

    if (!prRow || prRow.gym_id !== owner.gym_id) {
      return NextResponse.json(
        { error: 'PR verification not found for your gym.' },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('pr_verifications')
      .update({
        status: decision,
        review_notes: String(reviewNotes || '').trim() || null,
        reviewed_by: userData.user.id,
        reviewed_at: nowIso,
      })
      .eq('id', verificationId);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update PR status.' }, { status: 500 });
    }

    // When approved, update the athlete's PR on leaderboard_users if higher
    if (decision === 'approved' && prRow.user_id) {
      const col =
        prRow.lift_type === 'squat'
          ? 'squat_pr_kg'
          : prRow.lift_type === 'bench'
          ? 'bench_pr_kg'
          : 'deadlift_pr_kg';

      const { data: athlete } = await supabaseAdmin
        .from('leaderboard_users')
        .select(`id, ${col}`)
        .eq('id', prRow.user_id)
        .single();

      if (athlete) {
        const currentVal = Number((athlete as Record<string, unknown>)[col] || 0);
        const nextVal = Math.max(currentVal, Number(prRow.weight_kg));
        await supabaseAdmin
          .from('leaderboard_users')
          .update({ [col]: nextVal, updated_at: nowIso })
          .eq('id', prRow.user_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[review-pr] Error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
