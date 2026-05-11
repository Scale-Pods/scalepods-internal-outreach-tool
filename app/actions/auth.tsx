'use server';

import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword, comparePassword } from '@/lib/auth-utils';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

import { sendOTPEmail } from '@/lib/mail-utils';

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

        // Check if password change is required (every 90 days)
        const passwordsChangedAt = user.passwords_changed_at ? new Date(user.passwords_changed_at) : new Date(user.created_at);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        if (passwordsChangedAt < ninetyDaysAgo) {
            return { 
                error: 'Your password has expired (required every 90 days for security). Please reset it to continue.', 
                requiresReset: true,
                email: user.email 
            };
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

export async function forgotPassword(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;

    if (!email) {
        return { error: 'Email is required' };
    }

    try {
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('id, full_name, email')
            .eq('email', email)
            .single();

        if (user) {
            // Generate 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60000); // 15 minutes

            // Save OTP to users table
            const { error: updateError } = await supabaseAdmin
                .from('users')
                .update({
                    otp_code: otp,
                    otp_expires_at: expiresAt.toISOString()
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('Error saving OTP:', updateError);
                throw updateError;
            }

            // Send Email via SMTP
            try {
                await sendOTPEmail(email, otp, user.full_name || 'User');
                console.log(`OTP sent to ${email}`);
            } catch (mailErr) {
                console.error('SMTP Error:', mailErr);
                return { error: 'Failed to send OTP email. Please check your SMTP settings.' };
            }
        }

        return { 
            success: true, 
            message: 'If an account exists with that email, we have sent a 6-digit OTP.',
            email: email // Return email to pre-fill the reset form
        };
    } catch (err) {
        console.error('Forgot password error:', err);
        return { error: 'An unexpected error occurred' };
    }
}

export async function resetPassword(prevState: any, formData: FormData) {
    const email = formData.get('email') as string;
    const otp = formData.get('otp') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!email || !otp || !password || !confirmPassword) {
        return { error: 'All fields are required' };
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' };
    }

    try {
        // Validate user and OTP
        const { data: user, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (userError || !user) {
            return { error: 'Invalid request' };
        }

        if (user.otp_code !== otp) {
            return { error: 'Invalid OTP code' };
        }

        if (new Date(user.otp_expires_at) < new Date()) {
            return { error: 'OTP has expired. Please request a new one.' };
        }

        // Hash new password
        const passwordHash = await hashPassword(password);

        // Update user: new password, reset OTP, and update passwords_changed_at
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ 
                password_hash: passwordHash,
                otp_code: null,
                otp_expires_at: null,
                passwords_changed_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (updateError) throw updateError;

        return { success: true, message: 'Password updated successfully. You can now log in.' };
    } catch (err) {
        console.error('Reset password error:', err);
        return { error: 'An unexpected error occurred' };
    }
}

