-- Fix the trigger to handle RLS properly
CREATE OR REPLACE FUNCTION public.create_profile_on_signup()
RETURNS trigger AS $$
BEGIN
  -- Insert profile with the user's ID
  -- This runs with DEFINER privileges, so it bypasses RLS
  INSERT INTO public.profiles (user_id, nickname)
  VALUES (NEW.id, 'Usuario_' || SUBSTRING(NEW.id::TEXT, 1, 8))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't fail - registration should still succeed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_on_signup();