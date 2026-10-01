"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserDetailDialog } from "@/components/users/user-detail-dialog"
import {
  Search,
  User,
  Shield,
  Calendar,
  Mail,
  Phone,
  Eye,
  Download,
  MapPin,
  Loader2,
  AlertTriangle,
  Activity,
} from "lucide-react"
import type { AdminDashboardUser } from "@/lib/types"
import { fetchAllUsersForAdmin, updateUserStatus } from "@/lib/user-mapping"
import { getAllBranches } from "@/lib/military-ranks"
import { toast } from "sonner"

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminDashboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [cityFilter, setCityFilter] = useState("all")
  const [sexFilter, setSexFilter] = useState("all")
  const [selectedUser, setSelectedUser] = useState<AdminDashboardUser | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Fetch users from Firebase on component mount
  useEffect(() => {
    async function loadUsers() {
      try {
        setLoading(true)
        setError(null)
        const firebaseUsers = await fetchAllUsersForAdmin()
        setUsers(firebaseUsers)
      } catch (err) {
        setError("Error al cargar usuarios de Firebase")
        console.error(err)
        toast.error("Error al cargar usuarios")
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [])

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.militaryId.includes(searchTerm) ||
      user.sex?.toLowerCase().includes(searchTerm)
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    const matchesBranch = branchFilter === "all" || user.branch.toLowerCase().includes(branchFilter)
    const matchesCity = cityFilter === "all" || user.city?.toLowerCase().includes(cityFilter)
    const matchesSex =
      sexFilter === "all" ||
      (sexFilter === "unknown" ? !user.sex : user.sex?.toLowerCase() === sexFilter)
    return matchesSearch && matchesStatus && matchesBranch && matchesCity && matchesSex
  })

  // Get unique cities from users filtered by current search/status/branch
  // We exclude city filter to keep the dropdown populated when a city is selected
  const cities = useMemo(() => {
    const usersForCities = users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || user.status === statusFilter
      const matchesBranch = branchFilter === "all" || user.branch.toLowerCase().includes(branchFilter)
      const matchesSex =
        sexFilter === "all" ||
        (sexFilter === "unknown" ? !user.sex : user.sex?.toLowerCase() === sexFilter)
      return matchesSearch && matchesStatus && matchesBranch && matchesSex
    })

    const cityList = usersForCities.map((user) => user.city).filter((city): city is string => !!city)
    return [...new Set(cityList)].sort()
  }, [users, searchTerm, statusFilter, branchFilter, sexFilter])

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      inactive: "destructive",
    } as const

    const labels = {
      active: "Activo",
      inactive: "Inactivos",
    }

    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>
  }

  const handleViewDetails = (user: AdminDashboardUser) => {
    setSelectedUser(user)
    setIsDetailDialogOpen(true)
  }

  const handleApprove = async (userId: string) => {
    setActionLoading(userId)
    try {
      await updateUserStatus(userId, "active")
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "active" } : u)))
      toast.success("Usuario aprobado exitosamente")
      setIsDetailDialogOpen(false)
    } catch (error) {
      console.error("Error approving user:", error)
      toast.error("Error al aprobar usuario")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (userId: string) => {
    setActionLoading(userId)
    try {
      await updateUserStatus(userId, "rejected")
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: "rejected" } : u)))
      toast.success("Usuario rechazado")
      setIsDetailDialogOpen(false)
    } catch (error) {
      console.error("Error rejecting user:", error)
      toast.error("Error al rechazar usuario")
    } finally {
      setActionLoading(null)
    }
  }

  const exportUsers = () => {
    const csvContent = [
      "Primer Nombre,Segundo Nombre,Primer Apellido,Segundo Apellido,Email,ID Militar,Rango,Fuerza,Ciudad,Fecha de Registro",
      ...filteredUsers.map(user => {
        const regDate = user.registrationDate.toLocaleDateString()
        const city = user.city || "N/A"
        return `"${user.first_name}","${user.second_name}","${user.first_last_name}","${user.second_last_name}","${user.email}","${user.militaryId}","${user.rank}","${user.branch}","${city}","${regDate}"`
      })
    ].join("\n")

    // Add UTF-8 BOM for proper encoding of special characters
    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `usuarios_heroes_colombia_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra el proceso de verificación de usuarios militares</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{filteredUsers.filter((u) => u.status === "active").length} activos</Badge>
          <Badge variant="destructive">{filteredUsers.filter((u) => u.status === "inactive").length} inactivos</Badge>
          <Button onClick={exportUsers} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Fuerza" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fuerzas</SelectItem>
              {getAllBranches().map(branch => (
                <SelectItem key={branch} value={branch.toLowerCase()}>{branch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Ciudad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ciudades</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city.toLowerCase()}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sexFilter} onValueChange={setSexFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Sexo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los generos</SelectItem>
              <SelectItem value="male">Masculino</SelectItem>
              <SelectItem value="female">Femenino</SelectItem>
              <SelectItem value="unknown">Sin especificar</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{filteredUsers.length} usuarios</Badge>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Cargando usuarios</h3>
            <p className="text-muted-foreground">Obteniendo datos de Firebase...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-800">Error al cargar usuarios</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => (
            <Card
              key={user.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleViewDetails(user)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold truncate">{user.name}</h3>
                      {getStatusBadge(user.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3 text-sm text-muted-foreground mb-3">
                      <Badge variant="outline" className="text-xs">
                        {user.rank}
                      </Badge>
                      {user.city && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span>{user.city}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span>{user.email}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <span>{user.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {user.branch}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Registro: {user.registrationDate.toLocaleDateString("es-CO")}
                      </div>
                      {user.lastLogin && (
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          Último acceso: {user.lastLogin.toLocaleDateString("es-CO")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewDetails(user)
                    }}
                    title="Ver detalles"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredUsers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron usuarios</h3>
            <p className="text-muted-foreground">Intenta ajustar los filtros de búsqueda</p>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Detail Dialog */}
      <UserDetailDialog
        open={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        user={selectedUser}
        onApprove={handleApprove}
        onReject={handleReject}
        isLoading={actionLoading !== null}
      />
    </div>
  )
}
