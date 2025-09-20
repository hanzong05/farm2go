-- Create verification status enum
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected', 'not_submitted');

-- Add verification fields to profiles table
ALTER TABLE public.profiles ADD COLUMN verification_status verification_status DEFAULT 'not_submitted';
ALTER TABLE public.profiles ADD COLUMN id_document_url TEXT;
ALTER TABLE public.profiles ADD COLUMN face_photo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN verification_submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN verification_approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN verification_rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN verification_admin_notes TEXT;
ALTER TABLE public.profiles ADD COLUMN id_document_type TEXT; -- 'drivers_license', 'national_id', 'passport', etc.

-- Create verification_submissions table for admin review
CREATE TABLE public.verification_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    id_document_url TEXT NOT NULL,
    face_photo_url TEXT NOT NULL,
    id_document_type TEXT NOT NULL,
    submission_notes TEXT,
    status verification_status DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES public.profiles(id),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_profiles_verification_status ON public.profiles(verification_status);
CREATE INDEX idx_verification_submissions_status ON public.verification_submissions(status);
CREATE INDEX idx_verification_submissions_user_id ON public.verification_submissions(user_id);
CREATE INDEX idx_verification_submissions_submitted_at ON public.verification_submissions(submitted_at);

-- Create trigger for verification_submissions updated_at
CREATE TRIGGER update_verification_submissions_updated_at
    BEFORE UPDATE ON public.verification_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on verification_submissions table
ALTER TABLE public.verification_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for verification_submissions

-- Users can view their own verification submissions
CREATE POLICY "Users can view own verification submissions" ON public.verification_submissions
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own verification submissions
CREATE POLICY "Users can insert own verification submissions" ON public.verification_submissions
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own pending verification submissions
CREATE POLICY "Users can update own pending verification submissions" ON public.verification_submissions
    FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

-- Admins can view all verification submissions
CREATE POLICY "Admins can view all verification submissions" ON public.verification_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND user_type = 'admin'
        )
    );

-- Admins can update verification submissions (for approval/rejection)
CREATE POLICY "Admins can update verification submissions" ON public.verification_submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND user_type = 'admin'
        )
    );

-- Function to update profile verification status when submission is approved/rejected
CREATE OR REPLACE FUNCTION update_profile_verification_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the profile verification status based on submission status
    IF NEW.status = 'approved' THEN
        UPDATE public.profiles
        SET
            verification_status = 'approved',
            verification_approved_at = NOW(),
            verification_rejected_at = NULL,
            verification_admin_notes = NEW.admin_notes,
            id_document_url = NEW.id_document_url,
            face_photo_url = NEW.face_photo_url,
            id_document_type = NEW.id_document_type
        WHERE id = NEW.user_id;
    ELSIF NEW.status = 'rejected' THEN
        UPDATE public.profiles
        SET
            verification_status = 'rejected',
            verification_rejected_at = NOW(),
            verification_approved_at = NULL,
            verification_admin_notes = NEW.admin_notes
        WHERE id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update profile when verification submission status changes
CREATE TRIGGER update_profile_on_verification_change
    AFTER UPDATE OF status ON public.verification_submissions
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_profile_verification_status();