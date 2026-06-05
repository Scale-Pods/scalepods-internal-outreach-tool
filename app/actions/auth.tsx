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
            .setExpirationTime('1h')
            .sign(secret);

        (await cookies()).set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60, // 1 hour
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
        // Only process if user exists in custom users table
        const { data: user } = await supabaseAdmin
            .from('users')
            .select('email')
            .eq('email', email)
            .single();

        if (user) {
            // Check if a Supabase Auth user exists for this email
            const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

            if (listError) throw listError;

            const authUser = authUsers.users.find(u => u.email === email);

            if (!authUser) {
                // Create a shadow auth user so Supabase can send the recovery email
                const { error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    email_confirm: true,
                    password: crypto.randomUUID(),
                });

                if (createError) throw createError;
            }

            // Send recovery email via Supabase's built-in email service
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
                redirectTo: `${appUrl}/reset-password`,
            });

            if (resetError) throw resetError;
        }

        return {
            success: true,
            message: 'If an account exists with that email, check your inbox for a password reset link.',
        };
    } catch (err) {
        console.error('Forgot password error:', err);
        return { error: 'An unexpected error occurred' };
    }
}

export async function resetPassword(prevState: any, formData: FormData) {
    const token = formData.get('accessToken') as string;
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!token || !password || !confirmPassword) {
        return { error: 'All fields are required' };
    }

    if (password !== confirmPassword) {
        return { error: 'Passwords do not match' };
    }

    try {
        // Verify the recovery token and get the user's email
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user?.email) {
            return { error: 'Invalid or expired reset link. Please request a new one.' };
        }

        const email = user.email;

        // Hash the new password
        const passwordHash = await hashPassword(password);

        // Update the custom users table
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({
                password_hash: passwordHash,
                passwords_changed_at: new Date().toISOString(),
            })
            .eq('email', email);

        if (updateError) throw updateError;

        return { success: true, message: 'Password updated successfully. You can now log in.' };
    } catch (err) {
        console.error('Reset password error:', err);
        return { error: 'Invalid or expired reset link. Please request a new one.' };
    }
}

