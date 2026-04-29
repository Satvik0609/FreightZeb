import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

const ROLE_OPTIONS = [
  { value: 'WAREHOUSE', label: 'Warehouse Manager' },
  { value: 'DEALER', label: 'Truck Dealer' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'WAREHOUSE', phone: '', company: '' })
  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email) e.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 8) e.password = 'At least 8 characters'
    if (!form.role) e.role = 'Role is required'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const res = await authService.register(form)
      login(res.user || res.data?.user, res.token || res.data?.token)
      toast.success('Account created successfully!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">FreightZen</h1>
          <p className="text-blue-300 mt-1 text-sm">AI-Powered Logistics Platform</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Create account</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Join FreightZen today</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Full Name" placeholder="John Doe" value={form.name} onChange={set('name')} error={errors.name} required className="col-span-2" />
              <Input label="Email" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} error={errors.email} required className="col-span-2" />
              <div className="col-span-2 relative">
                <Input label="Password" type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" value={form.password} onChange={set('password')} error={errors.password} required
                  trailingIcon={
                    <button type="button" onClick={() => setShowPassword(v => !v)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>
              <Select label="Role" value={form.role} onChange={set('role')} options={ROLE_OPTIONS} error={errors.role} required />
              <Input label="Phone" type="tel" placeholder="+91 9876543210" value={form.phone} onChange={set('phone')} />
              <Input label="Company" placeholder="Company name" value={form.company} onChange={set('company')} className="col-span-2" />
            </div>

            <Button type="submit" className="w-full" loading={loading} size="lg">
              Create Account
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
