import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { IconBrand } from '../components/icons'
import { Label } from '../components/ui/label'
import { supabase } from '../lib/supabaseClient'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

type FormValues = z.infer<typeof schema>

export default function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation() as any
  const redirectTo = location.state?.from || '/dashboard'

  const { register, handleSubmit, formState, setValue } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: 'admin@gmail.com', password: 'admin@123' } })
  const onSubmit = async (values: FormValues) => {
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      if (error.message.toLowerCase().includes('invalid')) {
        // Attempt to create the admin user automatically
        const { error: signupErr } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { full_name: 'Admin' } },
        })
        if (signupErr) {
          return toast.error(
            signupErr.message +
              '. Create this user in Supabase Auth (Users) and mark as confirmed, then try again.'
          )
        }
        return toast.info(
          'Admin user created. If email confirmation is required, confirm the email in Supabase or disable confirmations, then sign in again.'
        )
      }
      return toast.error(error.message)
    }
    toast.success('Signed in')
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className="max-w-sm mx-auto">
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <IconBrand size={18} />
            </span>
            <CardTitle className="text-xl">Welcome back</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {formState.errors.email && (
                <p className="text-red-600 text-sm mt-1">{formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {formState.errors.password && (
                <p className="text-red-600 text-sm mt-1">{formState.errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full">Sign in</Button>
          </form>

          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setValue('email', 'admin@gmail.com')
                setValue('password', 'admin@123')
                void onSubmit({ email: 'admin@gmail.com', password: 'admin@123' })
              }}
            >
              Sign in as Admin
            </Button>
            <span className="text-xs text-muted-foreground">Uses preset credentials</span>
          </div>

          

          {/* <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin },
              })
              if (error) {
                if (error.message.toLowerCase().includes('provider is not enabled')) {
                  return toast.error(
                    'Google provider is not enabled in Supabase. Enable it in Auth → Providers → Google and add Client ID/Secret.'
                  )
                }
                return toast.error(error.message)
              }
              return data
            }}
          >
            <IconGoogle className="mr-2" size={16} /> Continue with Google
          </Button> */}
        </CardContent>
      </Card>
    </div>
  )
}
