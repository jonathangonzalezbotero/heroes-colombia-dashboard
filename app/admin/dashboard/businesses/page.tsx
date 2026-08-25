"use client"

import { useState, useEffect } from "react"
import { useCategories } from "@/hooks/use-categories"
import { useBusinesses } from "@/hooks/use-businesses"
import { usePromotions } from "@/hooks/use-promotions"
import { LocationService } from "@/lib/services/location-service"
import { AnalyticsEventService } from "@/lib/services/analytics-service"
import { getPlanLimits } from "@/lib/plan-limits"
import { formatBusinessHours, formatDate, formatDateTime } from "@/lib/helpers/business-helpers"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  Building2,
  MapPin,
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  Mail,
  Crown,
  Download,
  Store,
  ShoppingBag,
  Globe,
  Tag,
  BarChart2,
  CreditCard,
  AlertTriangle,
  Timer,
  CalendarPlus,
  Ban,
  PlayCircle,
} from "lucide-react"
import Link from "next/link"
import { PromotionService } from "@/lib/services/promotion-service"
import { auth } from "@/lib/firebase"
import type { BusinessSubscription } from "@/lib/types"

// Firebase restores the persisted session asynchronously; auth.currentUser can
// still be null on the first render of the page. Resolve once it settles.
function waitForFirebaseUser(timeoutMs = 5000) {
  return new Promise<import("firebase/auth").User | null>((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe()
      resolve(auth.currentUser)
    }, timeoutMs)
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        clearTimeout(timer)
        unsubscribe()
        resolve(user)
      }
    })
  })
}

// Helper to get subscription display info
function getSubscriptionDisplayInfo(business: any): {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
  daysRemaining: number | null
  isExpiringSoon: boolean
} {
  const subscription = business.subscription as BusinessSubscription | null | undefined

  if (!subscription) {
    // Legacy: check old fields
    if (business.subscription_status === "trial") {
      return { label: "Trial (legacy)", variant: "secondary", daysRemaining: null, isExpiringSoon: false }
    }
    return { label: "Sin suscripción", variant: "outline", daysRemaining: null, isExpiringSoon: false }
  }

  const now = new Date()
  let daysRemaining: number | null = null
  let isExpiringSoon = false

  // Calculate days remaining for trials
  if (subscription.end_date) {
    const endDate = subscription.end_date.toDate ? subscription.end_date.toDate() : new Date(subscription.end_date as any)
    const diffTime = endDate.getTime() - now.getTime()
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7
  }

  switch (subscription.status) {
    case "pending_payment":
      return { label: "Pago pendiente", variant: "secondary", daysRemaining, isExpiringSoon }
    case "trial":
      if (daysRemaining !== null && daysRemaining <= 0) {
        return { label: "Trial expirado", variant: "destructive", daysRemaining: 0, isExpiringSoon: false }
      }
      if (isExpiringSoon) {
        return { label: `Trial - ${daysRemaining}d`, variant: "destructive", daysRemaining, isExpiringSoon }
      }
      return { label: `Trial - ${daysRemaining}d`, variant: "default", daysRemaining, isExpiringSoon }
    case "active":
      const planLabel = subscription.plan === "fundador" ? "Fundador" : subscription.plan?.charAt(0).toUpperCase() + subscription.plan?.slice(1)
      return { label: planLabel || "Activa", variant: "default", daysRemaining, isExpiringSoon }
    case "past_due":
      return { label: "Pago vencido", variant: "destructive", daysRemaining, isExpiringSoon }
    case "cancelled":
      return { label: "Cancelada", variant: "secondary", daysRemaining, isExpiringSoon }
    case "expired":
      return { label: "Expirada", variant: "destructive", daysRemaining: 0, isExpiringSoon: false }
    default:
      return { label: subscription.status, variant: "outline", daysRemaining, isExpiringSoon }
  }
}

// Get subscription filter category for a business
function getSubscriptionFilterCategory(business: any): string {
  const subscription = business.subscription as BusinessSubscription | null | undefined
  if (!subscription) return "none"

  const now = new Date()

  if (subscription.status === "pending_payment") return "pending_payment"
  if (subscription.status === "expired") return "expired"
  if (subscription.status === "cancelled") return "cancelled"
  if (subscription.status === "active") return "active"
  if (subscription.status === "past_due") return "past_due"

  if (subscription.status === "trial") {
    if (!subscription.end_date) return "trial_active"

    const endDate = subscription.end_date.toDate ? subscription.end_date.toDate() : new Date(subscription.end_date as any)
    const diffTime = endDate.getTime() - now.getTime()
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (daysRemaining <= 0) return "trial_expired"
    if (daysRemaining <= 7) return "trial_expiring"
    return "trial_active"
  }

  return "none"
}

export default function AdminBusinessesPage() {
  const { getCategoryName } = useCategories()
  const { businesses, isLoading, refreshBusinesses, updateBusinessStatus } = useBusinesses()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [subscriptionFilter, setSubscriptionFilter] = useState("all")
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false)

  // Trial payment approval dialog
  const [showTrialApprovalDialog, setShowTrialApprovalDialog] = useState(false)
  const [trialApprovalBusinessId, setTrialApprovalBusinessId] = useState<string | null>(null)

  // Manual subscription approval dialog
  const [showSubscriptionApprovalDialog, setShowSubscriptionApprovalDialog] = useState(false)
  const [subscriptionApprovalBusiness, setSubscriptionApprovalBusiness] = useState<any>(null)
  const [approvalPlan, setApprovalPlan] = useState("basico")
  const [approvalBillingPeriod, setApprovalBillingPeriod] = useState("monthly")

  // Resource counts per business (cached)
  const [businessCounts, setBusinessCounts] = useState<Record<string, { locations: number; promotions: number }>>({})

  // Modal data
  const [modalLocations, setModalLocations] = useState<any[]>([])
  const [modalAnalytics, setModalAnalytics] = useState<any>(null)
  const [modalLoading, setModalLoading] = useState(false)

  // Hooks for selected business
  const { promotions } = usePromotions({ businessId: selectedBusiness?.id })

  const handleApprove = async (businessId: string) => {
    const success = await updateBusinessStatus(businessId, "approved", "Empresa aprobada por el administrador")
    if (success) {
      await refreshBusinesses()
    }
  }

  const handleReject = async (businessId: string) => {
    const success = await updateBusinessStatus(businessId, "rejected", "Empresa rechazada por el administrador")
    if (success) {
      await refreshBusinesses()
    }
  }

  const handleFlag = async (businessId: string) => {
    const success = await updateBusinessStatus(businessId, "suspended", "Empresa marcada para revisión")
    if (success) {
      await refreshBusinesses()
    }
  }

  // Admin subscription actions
  const handleSubscriptionAction = async (
    businessId: string,
    action: string,
    data?: Record<string, unknown>
  ) => {
    setIsUpdatingSubscription(true)
    try {
      // Wait for Firebase to restore the session before reading the token,
      // otherwise auth.currentUser is null right after a page load and we'd
      // send "Bearer undefined" (which the API rejects with a 401).
      const currentUser = auth.currentUser ?? (await waitForFirebaseUser())
      if (!currentUser) {
        throw new Error("Tu sesión expiró. Vuelve a iniciar sesión para continuar.")
      }
      const token = await currentUser.getIdToken(true)
      const response = await fetch("/api/admin/subscription", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessId,
          action,
          ...data,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.reason) {
          console.error("[Admin Subscription] Rejected:", result.reason)
        }
        throw new Error(result.error || "Error updating subscription")
      }

      await refreshBusinesses()
      // Refresh selected business data
      if (selectedBusiness?.id === businessId) {
        const updatedBusiness = businesses.find(b => b.id === businessId)
        if (updatedBusiness) {
          setSelectedBusiness(updatedBusiness)
        }
      }

      return { success: true, message: result.message }
    } catch (error) {
      console.error("Error updating subscription:", error)
      return { success: false, message: error instanceof Error ? error.message : "Error desconocido" }
    } finally {
      setIsUpdatingSubscription(false)
    }
  }

  const handleExtendTrial = async (businessId: string, days: number) => {
    return handleSubscriptionAction(businessId, "extend_trial", { days })
  }

  const handleExpireSubscription = async (businessId: string) => {
    return handleSubscriptionAction(businessId, "expire")
  }

  const handleCancelSubscription = async (businessId: string) => {
    return handleSubscriptionAction(businessId, "cancel")
  }

  const handleApproveTrialPayment = async (businessId: string) => {
    return handleSubscriptionAction(businessId, "approve_trial_payment")
  }

  const handleApproveManualSubscription = async (businessId: string, plan: string, billingPeriod: string) => {
    const amounts: Record<string, Record<string, number>> = {
      basico: { monthly: 70000, annual: 714000 },
      pro: { monthly: 270000, annual: 2754000 },
      enterprise: { monthly: 800000, annual: 8160000 },
      fundador: { monthly: 480000, annual: 4800000 },
    }
    const amount = amounts[plan]?.[billingPeriod] ?? 0
    return handleSubscriptionAction(businessId, "activate_subscription", { plan, billingPeriod, amount })
  }

  const getApprovalAmount = (plan: string, billingPeriod: string): number => {
    const amounts: Record<string, Record<string, number>> = {
      basico: { monthly: 70000, annual: 714000 },
      pro: { monthly: 270000, annual: 2754000 },
      enterprise: { monthly: 800000, annual: 8160000 },
      fundador: { monthly: 480000, annual: 4800000 },
    }
    return amounts[plan]?.[billingPeriod] ?? 0
  }

  const exportBusinesses = () => {
    const csvContent = [
      "Nombre,NIT,Email,Teléfono,Propietario,Estado,Plan,Tipo,Categorías,Dirección",
      ...filteredBusinesses.map((business) => {
        const regDate = business.created_at
          ? business.created_at instanceof Date
            ? business.created_at.toLocaleDateString()
            : (business.created_at as any).seconds
              ? new Date((business.created_at as any).seconds * 1000).toLocaleDateString()
              : "N/A"
          : "N/A"
        const categories = business.categories?.map((c) => getCategoryName(c)).join("; ") || ""
        const businessType = business.type || "N/A"
        return `"${business.name}","${business.identification}","${business.email}","${business.phone_number || "N/A"}","${business.owner_name}","${business.status}","${business.plan || "Básico"}","${businessType}","${categories}","${business.address}"`
      }),
    ].join("\n")

    // Add UTF-8 BOM for proper encoding of special characters
    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `empresas_heroes_colombia_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const filteredBusinesses = businesses.filter((business) => {
    const matchesSearch =
      business.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      business.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      business.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || business.status === statusFilter
    const matchesPlan = planFilter === "all" || business.plan?.toLowerCase() === planFilter

    // Subscription filter
    let matchesSubscription = true
    if (subscriptionFilter !== "all") {
      const subCategory = getSubscriptionFilterCategory(business)
      matchesSubscription = subCategory === subscriptionFilter
    }

    return matchesSearch && matchesStatus && matchesPlan && matchesSubscription
  })

  // Fetch locations and analytics when modal opens
  useEffect(() => {
    if (!selectedBusiness?.id) {
      setModalLocations([])
      setModalAnalytics(null)
      return
    }

    const fetchModalData = async () => {
      setModalLoading(true)
      try {
        const [locations, analytics] = await Promise.all([
          LocationService.getBusinessLocations(selectedBusiness.id),
          AnalyticsEventService.getEventCountsByType(selectedBusiness.id),
        ])
        setModalLocations(locations || [])
        setModalAnalytics(analytics)
      } catch (error) {
        console.error("Error fetching modal data:", error)
      } finally {
        setModalLoading(false)
      }
    }

    fetchModalData()
  }, [selectedBusiness?.id])

  // Fetch resource counts for each business in cards
  useEffect(() => {
    const fetchCounts = async () => {
      // Fetch counts for businesses that don't have them yet
      const businessesToFetch = filteredBusinesses.slice(0, 20).filter((b) => !businessCounts[b.id])

      if (businessesToFetch.length === 0) return

      const newCounts: Record<string, { locations: number; promotions: number }> = {}

      await Promise.all(
        businessesToFetch.map(async (business) => {
          try {
            const locations = await LocationService.getBusinessLocations(business.id)

            const filters = {
              businessId: business.id,
            }
            const promotions = await PromotionService.getPromotions(filters)
            // For promotions count, we'd need to fetch, but let's keep it simple for now
            newCounts[business.id] = {
              locations: locations?.length || 0,
              promotions: promotions?.length || 0,
            }
          } catch (error) {
            console.error(`Error fetching counts for ${business.id}:`, error)
            newCounts[business.id] = { locations: 0, promotions: 0 }
          }
        })
      )

      setBusinessCounts((prev) => ({ ...prev, ...newCounts }))
    }

    fetchCounts()
  }, [filteredBusinesses.map((b) => b.id).join(","), businessCounts])

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: "default",
      pending: "secondary",
      suspended: "destructive",
      rejected: "destructive",
    } as const

    const labels = {
      approved: "Aprobada",
      pending: "Pendiente",
      suspended: "Marcada",
      rejected: "Rechazada",
    }

    return <Badge variant={variants[status as keyof typeof variants]}>{labels[status as keyof typeof labels]}</Badge>
  }

  const getPlanBadge = (plan: string) => {
    const isPremium = plan === "Pro" || plan === "Enterprise"
    return (
      <Badge variant={isPremium ? "default" : "secondary"} className="flex items-center gap-1">
        {isPremium && <Crown className="h-3 w-3" />}
        {plan}
      </Badge>
    )
  }

  const getSubscriptionBadge = (business: any) => {
    const info = getSubscriptionDisplayInfo(business)
    return (
      <Badge variant={info.variant} className="flex items-center gap-1">
        {info.isExpiringSoon && <AlertTriangle className="h-3 w-3" />}
        {info.label}
      </Badge>
    )
  }

  const getTypeBadge = (type: string) => {
    const config = {
      physical: { label: "Física", icon: Store, variant: "outline" as const },
      online: { label: "Online", icon: Globe, variant: "outline" as const },
      hybrid: { label: "Híbrida", icon: ShoppingBag, variant: "outline" as const },
    }

    const typeConfig = config[type as keyof typeof config] || config.physical
    const Icon = typeConfig.icon

    return (
      <Badge variant={typeConfig.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {typeConfig.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Empresas</h1>
          <p className="text-muted-foreground">Administra empresas registradas y solicitudes pendientes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{businesses.filter((b) => b.status === "active").length} activas</Badge>
          <Badge variant="secondary">{businesses.filter((b) => b.status === "pending").length} pendientes</Badge>
          <Badge variant="destructive">{businesses.filter((b) => b.status === "suspended").length} marcadas</Badge>
          <Button onClick={exportBusinesses} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="approved">Aprobadas</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="suspended">Marcadas</SelectItem>
            <SelectItem value="rejected">Rechazadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los planes</SelectItem>
            <SelectItem value="básico">Básico</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Suscripción" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las suscripciones</SelectItem>
            <SelectItem value="trial_active">Trial activo</SelectItem>
            <SelectItem value="trial_expiring">Trial por vencer (&lt;7d)</SelectItem>
            <SelectItem value="trial_expired">Trial expirado</SelectItem>
            <SelectItem value="active">Suscripción activa</SelectItem>
            <SelectItem value="pending_payment">Pago pendiente</SelectItem>
            <SelectItem value="past_due">Pago vencido</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
            <SelectItem value="expired">Expirada</SelectItem>
            <SelectItem value="none">Sin suscripción</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Businesses List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Cargando empresas...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBusinesses.map((business) => (
              <Card key={business.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-lg font-semibold">{business.name}</h3>
                        {getStatusBadge(business.status)}
                        {getSubscriptionBadge(business)}
                        {getTypeBadge(business.type || "physical")}
                        {business.featured && <Badge variant="secondary">Destacado</Badge>}
                        {business.subscription?.is_founder && (
                          <Badge variant="default" className="bg-amber-500 flex items-center gap-1">
                            <Crown className="h-3 w-3" />
                            Fundador
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{business.address || "Sin dirección"}</span>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{business.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 shrink-0" />
                          <span>{business.phone_number || "N/A"}</span>
                        </div>
                        <div className="flex items-start gap-2 min-w-0">
                          <Tag className="h-4 w-4 shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{business.categories?.map((cat: string) => getCategoryName(cat)).join(", ") || "Sin categoría"}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground border-t pt-2">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="font-medium">{businessCounts[business.id]?.locations ?? "..."}</span> ubicaciones
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          <span className="font-medium">{businessCounts[business.id]?.promotions ?? "..."}</span> promociones
                        </span>
                        <span className="flex items-center gap-1 ml-auto">
                          <Calendar className="h-3 w-3" />
                          {business.created_at ? ((business.created_at as any).seconds ? new Date((business.created_at as any).seconds * 1000).toLocaleDateString() : new Date(business.created_at as Date).toLocaleDateString()) : "N/A"}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground mt-2">
                        Propietario: {business.owner_name}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                      <Link href={`/admin/dashboard/businesses/${business.id}/analytics`}>
                        <Button variant="ghost" size="icon" title="Ver analíticas">
                          <BarChart2 className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedBusiness(business)
                          setIsDetailOpen(true)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {business.status === "pending" && (
                        <>
                          {business.subscription?.status !== "pending_payment" && (
                            <Button size="sm" onClick={() => handleApprove(business.id)}>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Aprobar
                            </Button>
                          )}
                          <Button variant="destructive" size="sm" onClick={() => handleReject(business.id)}>
                            <XCircle className="h-4 w-4 mr-1" />
                            Rechazar
                          </Button>
                        </>
                      )}

                      {business.status === "approved" && (
                        <Button variant="outline" size="sm" onClick={() => handleFlag(business.id)}>
                          Marcar
                        </Button>
                      )}
                      {business.subscription?.status === "pending_payment" && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            setTrialApprovalBusinessId(business.id)
                            setShowTrialApprovalDialog(true)
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprobar Trial
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {filteredBusinesses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No se encontraron empresas</h3>
            <p className="text-muted-foreground">Intenta ajustar los filtros de búsqueda</p>
          </CardContent>
        </Card>
      )}

      {/* Business detail dialog — single controlled instance, outside the card map */}
      <Dialog
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open)
          if (!open) setSelectedBusiness(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de {selectedBusiness?.name}</DialogTitle>
          </DialogHeader>
          {selectedBusiness && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">Info General</TabsTrigger>
                <TabsTrigger value="locations">Ubicaciones</TabsTrigger>
                <TabsTrigger value="promotions">Promociones</TabsTrigger>
                <TabsTrigger value="subscription">Suscripción</TabsTrigger>
              </TabsList>
              <TabsContent value="info" className="space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Business Information */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Información del Negocio
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm bg-muted/30 p-3 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">Nombre:</span>
                      <p className="font-medium">{selectedBusiness.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">NIT:</span>
                      <p className="font-medium">{selectedBusiness.identification || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo:</span>
                      <p className="font-medium">{getTypeBadge(selectedBusiness.type || "physical")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Destacado:</span>
                      <p className="font-medium">{selectedBusiness.featured ? "Sí" : "No"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Categorías:</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {selectedBusiness.categories?.map((cat: string) => (
                          <Badge key={cat} variant="secondary" className="text-xs">
                            {getCategoryName(cat)}
                          </Badge>
                        )) || <span className="text-sm">Sin categoría</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Información de Contacto
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm bg-muted/30 p-3 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{selectedBusiness.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Teléfono:</span>
                      <p className="font-medium">{selectedBusiness.phone_number || "N/A"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Sitio web:</span>
                      <p className="font-medium">
                        {selectedBusiness.website ? (
                          <a href={selectedBusiness.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {selectedBusiness.website}
                          </a>
                        ) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Propietario:</span>
                      <p className="font-medium">{selectedBusiness.owner_name}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Dirección:</span>
                      <p className="font-medium">{selectedBusiness.address || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Resource Usage */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Uso de Recursos
                  </h4>
                  <div className="space-y-3 bg-muted/30 p-3 rounded-lg">
                    {(() => {
                      const planLimits = getPlanLimits(selectedBusiness.plan || "basico")
                      const locationsCount = modalLocations.length
                      const promotionsCount = promotions?.filter((p) => p.status === "active").length || 0
                      const teamMembersCount = 0

                      const getProgressColor = (current: number, max: number | null) => {
                        if (!max) return "bg-primary"
                        const percentage = (current / max) * 100
                        if (percentage >= 90) return "bg-destructive"
                        if (percentage >= 70) return "bg-yellow-500"
                        return "bg-primary"
                      }

                      return (
                        <>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Ubicaciones</span>
                              <span className="font-medium">
                                {locationsCount} / {planLimits.maxLocations === null ? "∞" : planLimits.maxLocations}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`${getProgressColor(locationsCount, planLimits.maxLocations)} h-2 rounded-full transition-all`}
                                style={{
                                  width: planLimits.maxLocations
                                    ? `${Math.min((locationsCount / planLimits.maxLocations) * 100, 100)}%`
                                    : "0%",
                                }}
                              ></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Promociones activas</span>
                              <span className="font-medium">
                                {promotionsCount} /{" "}
                                {planLimits.maxActivePromotions === null ? "Por pago" : planLimits.maxActivePromotions}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`${getProgressColor(promotionsCount, planLimits.maxActivePromotions ?? null)} h-2 rounded-full transition-all`}
                                style={{
                                  width: planLimits.maxActivePromotions
                                    ? `${Math.min((promotionsCount / planLimits.maxActivePromotions) * 100, 100)}%`
                                    : "0%",
                                }}
                              ></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Miembros del equipo</span>
                              <span className="font-medium">
                                {teamMembersCount} / {planLimits.maxUsers}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`${getProgressColor(teamMembersCount, planLimits.maxUsers)} h-2 rounded-full transition-all`}
                                style={{
                                  width: `${Math.min((teamMembersCount / planLimits.maxUsers) * 100, 100)}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </TabsContent>

              {/* Locations Tab */}
              <TabsContent value="locations" className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    {modalLocations.length > 0
                      ? `${modalLocations.length} ubicación${modalLocations.length > 1 ? "es" : ""} (${modalLocations.filter((l) => l.is_primary).length} principal${modalLocations.filter((l) => l.is_primary).length > 1 ? "es" : ""})`
                      : "Ubicaciones configuradas para este negocio"}
                  </p>
                </div>

                {modalLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : modalLocations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No hay ubicaciones configuradas</h3>
                    <p className="text-muted-foreground text-sm">
                      Este negocio aún no ha configurado ubicaciones
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {modalLocations.map((location) => (
                      <Card key={location.id}>
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-semibold">{location.name}</h5>
                                {location.is_primary && <Badge variant="default">Principal</Badge>}
                                <Badge variant="outline">{location.type === "physical" ? "Física" : "Online"}</Badge>
                                <Badge variant={location.status === "active" ? "default" : "secondary"}>
                                  {location.status === "active" ? "Activa" : "Inactiva"}
                                </Badge>
                              </div>
                            </div>

                            {location.type === "physical" && location.address && (
                              <div className="space-y-2 text-sm">
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                  <span>{location.address}</span>
                                </div>
                                {location.business_hours && location.business_hours.length > 0 && (
                                  <div className="flex items-start gap-2">
                                    <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                    <div className="flex-1">
                                      <p className="font-medium mb-1">Horario de atención:</p>
                                      <div className="space-y-0.5 text-muted-foreground">
                                        {formatBusinessHours(location.business_hours).map((hours, idx) => (
                                          <div key={idx}>{hours}</div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {location.type === "online" && (
                              <div className="space-y-2 text-sm">
                                {location.delivery_zones && location.delivery_zones.length > 0 && (
                                  <div>
                                    <p className="font-medium">Zonas de entrega:</p>
                                    <p className="text-muted-foreground">{location.delivery_zones.join(", ")}</p>
                                  </div>
                                )}
                                {location.shipping_info && (
                                  <div>
                                    <p className="font-medium">Información de envío:</p>
                                    <p className="text-muted-foreground">{location.shipping_info}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {(location.phone || location.email || location.website) && (
                              <div className="flex gap-4 text-sm text-muted-foreground border-t pt-2">
                                {location.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {location.phone}
                                  </span>
                                )}
                                {location.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {location.email}
                                  </span>
                                )}
                                {location.website && (
                                  <a
                                    href={location.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline"
                                  >
                                    <Globe className="h-3 w-3" />
                                    Sitio web
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Promotions & Analytics Tab */}
              <TabsContent value="promotions" className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Promociones
                  </h4>

                  {modalLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : !promotions || promotions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center bg-muted/30 rounded-lg">
                      <Tag className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No hay promociones creadas aún</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-4 mb-4 text-sm">
                        <span>Total: <strong>{promotions.length}</strong></span>
                        <span>Activas: <strong>{promotions.filter((p) => p.status === "active").length}</strong></span>
                        <span>Vencidas: <strong>{promotions.filter((p) => p.status === "inactive").length}</strong></span>
                      </div>
                      <div className="space-y-3">
                        {promotions.slice(0, 5).map((promo) => (
                          <Card key={promo.id}>
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h6 className="font-semibold text-sm">{promo.title}</h6>
                                    <Badge variant={promo.status === "active" ? "default" : "secondary"} className="text-xs">
                                      {promo.status === "active" ? "Activa" : "Vencida"}
                                    </Badge>
                                    {promo.is_featured && (
                                      <Badge variant="secondary" className="text-xs">Destacada</Badge>
                                    )}
                                  </div>
                                  <p className="text-lg font-bold text-primary">{promo.percentage}% OFF</p>
                                  <p className="text-xs text-muted-foreground">
                                    Válida hasta: {promo.expired_at ? formatDate(promo.expired_at) : "N/A"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-4 text-xs text-muted-foreground border-t pt-2">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  {promo.views_count || 0} vistas
                                </span>
                                <span className="flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  {promo.saves_count || 0} guardados
                                </span>
                                <span className="flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  {promo.redemptions_count || 0} redenciones
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {promotions.length > 5 && (
                          <p className="text-xs text-center text-muted-foreground">
                            Mostrando 5 de {promotions.length} promociones
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Analytics Section */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Analíticas
                  </h4>
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{modalAnalytics?.impressions || 0}</p>
                      <p className="text-xs text-muted-foreground">Impresiones</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{modalAnalytics?.views || 0}</p>
                      <p className="text-xs text-muted-foreground">Vistas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{modalAnalytics?.saves || 0}</p>
                      <p className="text-xs text-muted-foreground">Guardados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{modalAnalytics?.redemptions || 0}</p>
                      <p className="text-xs text-muted-foreground">Redenciones</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm bg-muted/30 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span className="text-muted-foreground">Registrado:</span>
                      <span className="font-medium">{formatDate(selectedBusiness.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-muted-foreground">Última actualización:</span>
                      <span className="font-medium">{formatDate(selectedBusiness.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Subscription Tab */}
              <TabsContent value="subscription" className="space-y-4 max-h-[60vh] overflow-y-auto">
                {(() => {
                  const subscription = selectedBusiness.subscription as BusinessSubscription | null | undefined
                  const displayInfo = getSubscriptionDisplayInfo(selectedBusiness)

                  if (!subscription) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Sin suscripción</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                          Este negocio no tiene una suscripción activa
                        </p>
                        <Button
                          onClick={() => {
                            setSubscriptionApprovalBusiness(selectedBusiness)
                            setApprovalPlan("basico")
                            setApprovalBillingPeriod("monthly")
                            setShowSubscriptionApprovalDialog(true)
                          }}
                          disabled={isUpdatingSubscription}
                        >
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Aprobar Suscripción
                        </Button>
                      </div>
                    )
                  }

                  const formatSubscriptionDate = (timestamp: any) => {
                    if (!timestamp) return "N/A"
                    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
                    return date.toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  }

                  return (
                    <>
                      {/* Subscription Status */}
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Estado de Suscripción
                        </h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm bg-muted/30 p-4 rounded-lg">
                          <div>
                            <span className="text-muted-foreground">Tipo:</span>
                            <p className="font-medium capitalize">
                              {subscription.type === "trial" ? "Período de prueba" :
                                subscription.type === "mercadopago" ? "MercadoPago" : "Manual"}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Estado:</span>
                            <div className="mt-1">
                              <Badge variant={displayInfo.variant}>{displayInfo.label}</Badge>
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Plan:</span>
                            <p className="font-medium capitalize flex items-center gap-1">
                              {subscription.plan}
                              {subscription.is_founder && (
                                <Crown className="h-4 w-4 text-amber-500" />
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Período:</span>
                            <p className="font-medium">
                              {subscription.billing_period === "annual" ? "Anual" :
                                subscription.billing_period === "monthly" ? "Mensual" : "N/A"}
                            </p>
                          </div>
                          <div className="col-span-2 border-t pt-2 mt-2">
                            <span className="text-muted-foreground">Fecha inicio:</span>
                            <p className="font-medium">{formatSubscriptionDate(subscription.start_date)}</p>
                          </div>
                          {subscription.type === "trial" && (
                            <>
                              <div>
                                <span className="text-muted-foreground">Fecha vencimiento:</span>
                                <p className="font-medium">{formatSubscriptionDate(subscription.end_date)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Días restantes:</span>
                                <p className={`font-medium ${displayInfo.daysRemaining !== null && displayInfo.daysRemaining <= 7 ? "text-destructive" : ""}`}>
                                  {displayInfo.daysRemaining !== null ? (
                                    displayInfo.daysRemaining <= 0 ? "Expirado" : `${displayInfo.daysRemaining} días`
                                  ) : "N/A"}
                                </p>
                              </div>
                            </>
                          )}
                          {subscription.type === "mercadopago" && (
                            <>
                              <div>
                                <span className="text-muted-foreground">Próximo pago:</span>
                                <p className="font-medium">{formatSubscriptionDate(subscription.next_payment_date)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Último pago:</span>
                                <p className="font-medium">{formatSubscriptionDate(subscription.last_payment_date)}</p>
                              </div>
                            </>
                          )}
                          <div className="col-span-2 border-t pt-2 mt-2">
                            <span className="text-muted-foreground">Monto:</span>
                            <p className="font-medium">
                              ${subscription.amount?.toLocaleString("es-CO")} {subscription.currency}
                            </p>
                          </div>
                          {subscription.mercadopago_payer_email && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Email pago:</span>
                              <p className="font-medium">{subscription.mercadopago_payer_email}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Admin Actions */}
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Timer className="h-4 w-4" />
                          Acciones de Admin
                        </h4>
                        <div className="flex flex-wrap gap-2 bg-muted/30 p-4 rounded-lg">
                          {subscription.type === "trial" && subscription.status !== "expired" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExtendTrial(selectedBusiness.id, 7)}
                                disabled={isUpdatingSubscription}
                              >
                                <CalendarPlus className="h-4 w-4 mr-1" />
                                +7 días
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExtendTrial(selectedBusiness.id, 14)}
                                disabled={isUpdatingSubscription}
                              >
                                <CalendarPlus className="h-4 w-4 mr-1" />
                                +14 días
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleExtendTrial(selectedBusiness.id, 30)}
                                disabled={isUpdatingSubscription}
                              >
                                <CalendarPlus className="h-4 w-4 mr-1" />
                                +30 días
                              </Button>
                            </>
                          )}

                          {subscription.status === "pending_payment" && (
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => {
                                setTrialApprovalBusinessId(selectedBusiness.id)
                                setShowTrialApprovalDialog(true)
                              }}
                              disabled={isUpdatingSubscription}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Aprobar Trial
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => {
                              setSubscriptionApprovalBusiness(selectedBusiness)
                              setApprovalPlan("basico")
                              setApprovalBillingPeriod("monthly")
                              setShowSubscriptionApprovalDialog(true)
                            }}
                            disabled={isUpdatingSubscription}
                          >
                            <PlayCircle className="h-4 w-4 mr-1" />
                            Aprobar Suscripción
                          </Button>

                          {subscription.status !== "expired" && subscription.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleExpireSubscription(selectedBusiness.id)}
                              disabled={isUpdatingSubscription}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Marcar Expirado
                            </Button>
                          )}

                          {subscription.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelSubscription(selectedBusiness.id)}
                              disabled={isUpdatingSubscription}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Cancelar
                            </Button>
                          )}

                          {isUpdatingSubscription && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                              Actualizando...
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Creado: {formatSubscriptionDate(subscription.created_at)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3" />
                          Actualizado: {formatSubscriptionDate(subscription.updated_at)}
                        </div>
                      </div>
                    </>
                  )
                })()}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Trial payment approval confirmation */}
      <AlertDialog open={showTrialApprovalDialog} onOpenChange={setShowTrialApprovalDialog}>
        <AlertDialogContent className="mx-4 max-w-sm sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar aprobación de pago</AlertDialogTitle>
            <AlertDialogDescription>
              Se activará un período de prueba de <strong>2 meses</strong> con acceso Enterprise completo.
              El negocio quedará marcado como activo automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
              onClick={async () => {
                if (trialApprovalBusinessId) {
                  await handleApproveTrialPayment(trialApprovalBusinessId)
                  setShowTrialApprovalDialog(false)
                  setTrialApprovalBusinessId(null)
                  setIsDetailOpen(false)
                  setSelectedBusiness(null)
                }
              }}
            >
              Confirmar Aprobación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manual subscription approval with plan selection */}
      <Dialog open={showSubscriptionApprovalDialog} onOpenChange={setShowSubscriptionApprovalDialog}>
        <DialogContent className="mx-4 max-w-sm sm:mx-auto">
          <DialogHeader>
            <DialogTitle>Aprobar Suscripción Manual</DialogTitle>
            <DialogDescription>
              Selecciona el plan y período para{" "}
              <strong>{subscriptionApprovalBusiness?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="approval-plan">Plan</Label>
              <Select value={approvalPlan} onValueChange={setApprovalPlan}>
                <SelectTrigger id="approval-plan" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="fundador">Fundador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approval-period">Período de facturación</Label>
              <Select value={approvalBillingPeriod} onValueChange={setApprovalBillingPeriod}>
                <SelectTrigger id="approval-period" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Monto: </span>
              <span className="font-semibold">
                ${getApprovalAmount(approvalPlan, approvalBillingPeriod).toLocaleString("es-CO")} COP
              </span>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setShowSubscriptionApprovalDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={isUpdatingSubscription}
              onClick={async () => {
                if (subscriptionApprovalBusiness) {
                  await handleApproveManualSubscription(
                    subscriptionApprovalBusiness.id,
                    approvalPlan,
                    approvalBillingPeriod
                  )
                  setShowSubscriptionApprovalDialog(false)
                  setSubscriptionApprovalBusiness(null)
                  setIsDetailOpen(false)
                  setSelectedBusiness(null)
                }
              }}
            >
              {isUpdatingSubscription ? "Activando..." : "Activar Suscripción"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
