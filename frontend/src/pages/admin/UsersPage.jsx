import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Users, Trash2, Shield, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminService } from '@/services/admin.service'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import RoleBadge from '@/components/shared/RoleBadge'
import StatusBadge from '@/components/shared/StatusBadge'
import EmptyState from '@/components/shared/EmptyState'
import PageHeader from '@/components/layout/PageHeader'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatDate, formatRelative } from '@/utils/formatters'
import { ROLES } from '@/utils/constants'

export default function UsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [changeRoleUser, setChangeRoleUser] = useState(null)
  const [newRole, setNewRole] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminService.getUsers(),
    staleTime: 60 * 1000,
  })

  const users = (data?.users || data?.data || []).filter((u) => {
    const matchSearch = !search || `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
    const matchRole = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => adminService.toggleUser(id),
    onSuccess: () => { toast.success('User status updated'); qc.invalidateQueries({ queryKey: ['admin-users'] }) },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => adminService.deleteUser(id),
    onSuccess: () => { toast.success('User deleted'); qc.invalidateQueries({ queryKey: ['admin-users'] }) },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }) => adminService.changeRole(id, role),
    onSuccess: () => {
      toast.success('Role updated!')
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setChangeRoleUser(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const columns = [
    {
      key: 'name', label: 'User', sortable: true, render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
            {row.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm text-gray-900 dark:text-white">{row.name}</p>
            <p className="text-xs text-gray-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', label: 'Role', render: (v) => <RoleBadge role={v} /> },
    {
      key: 'isActive', label: 'Status', render: (v) => (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {v ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    { key: 'company', label: 'Company', render: (v) => <span className="text-sm text-gray-500">{v || '—'}</span> },
    { key: 'createdAt', label: 'Joined', sortable: true, render: (v) => <span className="text-xs text-gray-400">{formatDate(v)}</span> },
    {
      key: 'actions', label: 'Actions', render: (_, row) => (
        <div className="flex items-center gap-1">
          <Button size="xs" variant="ghost" onClick={(e) => { e.stopPropagation(); setChangeRoleUser(row); setNewRole(row.role) }} title="Change role">
            <Shield className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="xs" variant="ghost"
            onClick={(e) => { e.stopPropagation(); toggleMutation.mutate(row.id) }}
            loading={toggleMutation.isPending}
            title={row.isActive ? 'Deactivate' : 'Activate'}
          >
            {row.isActive ? <ToggleRight className="w-3.5 h-3.5 text-green-500" /> : <ToggleLeft className="w-3.5 h-3.5 text-gray-400" />}
          </Button>
          <Button
            size="xs" variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`Delete user ${row.name}? This cannot be undone.`)) deleteMutation.mutate(row.id)
            }}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="User Management" subtitle={`${users.length} users`} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {ROLES.map((role) => (
          <Card key={role}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{role}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(data?.users || data?.data || []).filter(u => u.role === role).length}
                </p>
              </div>
              <RoleBadge role={role} size="lg" />
            </div>
          </Card>
        ))}
      </div>

      <Card padding={false}>
        <div className="p-4 flex gap-3">
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="w-4 h-4" />} className="flex-1" />
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} options={ROLES.map(r => ({ value: r, label: r }))} placeholder="All Roles" className="w-36" />
        </div>

        {isLoading ? <SkeletonTable rows={5} cols={6} /> : (
          users.length === 0 ? (
            <EmptyState icon={Users} title="No users found" description="No users match your search filters" />
          ) : (
            <Table columns={columns} data={users} />
          )
        )}
      </Card>

      <Modal isOpen={!!changeRoleUser} onClose={() => setChangeRoleUser(null)} title="Change User Role">
        {changeRoleUser && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Changing role for <strong>{changeRoleUser.name}</strong></p>
            <Select
              label="New Role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              options={ROLES.map(r => ({ value: r, label: r }))}
            />
            <div className="flex gap-3">
              <Button
                onClick={() => changeRoleMutation.mutate({ id: changeRoleUser.id, role: newRole })}
                loading={changeRoleMutation.isPending}
                disabled={newRole === changeRoleUser.role}
                className="flex-1"
              >
                Update Role
              </Button>
              <Button variant="secondary" onClick={() => setChangeRoleUser(null)} className="flex-1">Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
