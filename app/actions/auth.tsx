'use server';

import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, comparePassword } from '@/lib/auth-utils';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-change-this';
const secret = new TextEncoder().encode(JWT_SECRET);

export async function login(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
        return { error: 'Email and password are required' };
    }

    try {
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return { error: 'Invalid email or password' };
        }

        const isPasswordValid = await comparePassword(password, user.password_hash);
        if (!isPasswordValid) {
            return { error: 'Invalid email or password' };
        }

        // Create JWT
        const token = await new SignJWT({ userId: user.id, email: user.email })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(secret);

        (await cookies()).set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24, // 1 day
            path: '/',
        });

        return { success: true };
    } catch (err) {
        console.error('Login error:', err);
        return { error: 'An unexpected error occurred' };
    }
}

export async function signup(prevState: any, formData: FormData) {
    return { error: 'Signup is currently disabled. Please contact an administrator.' };
}

export async function logout() {
    (await cookies()).delete('auth_token');
    return { success: true };
}

import { Resend } from 'resend';
import { ResetPasswordEmail } from '@/components/emails/reset-password-template';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function forgotPassword(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;

    if (!email) {
        return { error: 'Email is required' };
    }

    try {
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('id, full_name')
            .eq('email', email)
            .single();

        if (user) {
            console.log(`Found user: ${user.full_name}, generating token...`);
            const token = crypto.randomUUID();
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour

            // Save token to Supabase (Ensure you have run the SQL to create this table)
            const { error: resetError } = await supabaseAdmin
                .from('password_resets')
                .insert([{
                    email,
                    token,
                    expires_at: expiresAt.toISOString()
                }]);

            if (resetError) {
                console.error('Database error saving reset token:', resetError);
                throw resetError;
            }

            // Send Email
            const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
            console.log(`Sending email to ${email} via Resend... Link: ${resetLink}`);

            const { data, error } = await resend.emails.send({
                from: 'ScalePods <onboarding@resend.dev>',
                to: [email],
                subject: 'Reset your ScalePods password',
                react: <ResetPasswordEmail fullName={user.full_name} resetLink={resetLink} />,
            });

            if (error) {
                console.error('Resend API error:', error);
                return { error: 'Failed to send reset email. Please try again later.' };
            }

            console.log('Resend success:', data);
        } else {
            console.log(`No user found with email: ${email}`);
        }

        return { success: true, message: 'If an account exists with that email, we have sent password reset instructions.' };
    } catch (err) {
        console.error('Forgot password error:', err);
        return { error: 'An unexpected error occurred' };
    }
}

export async function resetPassword(prevState: any, formData: FormData) {
    const token = formData.get('token') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!token || !password || !confirmPassword) {
        return { error: 'All fields are required' };
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' };
    }

    try {
        // Validate token
        const { data: resetEntry, error: tokenError } = await supabaseAdmin
            .from('password_resets')
            .select('*')
            .eq('token', token)
            .single();

        if (tokenError || !resetEntry || new Date(resetEntry.expires_at) < new Date()) {
            return { error: 'Invalid or expired token' };
        }

        // Hash new password
        const passwordHash = await hashPassword(password);

        // Update user
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('email', resetEntry.email);

        if (updateError) throw updateError;

        // Delete used token
        await supabaseAdmin
            .from('password_resets')
            .delete()
            .eq('token', token);

        return { success: true, message: 'Password updated successfully. You can now log in.' };
    } catch (err) {
        console.error('Reset password error:', err);
        return { error: 'An unexpected error occurred' };
    }
}
