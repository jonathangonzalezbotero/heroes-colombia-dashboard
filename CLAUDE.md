# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**Heroes Colombia Business Dashboard** is a Next.js 14 application serving as the management platform for business owners who participate in the Heroes Colombia ecosystem. This dashboard enables businesses to manage locations, promotions, team members, redemptions, analytics, and billing - all while enforcing plan-based limits and features.

**Relationship to Website**: This dashboard is where businesses land AFTER completing the trial payment ($7,140 COP) on the marketing website (heroes colombia-website). All pricing, features, and plan limits defined here MUST match exactly what's promised on the marketing site.

---

## Pricing Plans (Source of Truth from Website)

All prices include 19% IVA. These are the EXACT plans businesses select after their trial period ends (Feb 1, 2026).

### Plan Gratis (Free)
**Monthly Cost**: $0 COP
**Per Promotion**: $11,900 COP (10,000 + 19% IVA)

**Limits:**
- 1 ubicación (physical or online)
- Pay-per-promotion model
- 1 user
- No active promotion limit (but pay $11,900 per promotion published)

**Features:**
- Analítica básica
- Soporte por email
- Basic redemption tracking
- Standard listing in app

---

### Plan Básico
**Monthly**: $70,000 COP
**Annual**: $714,000 COP (saves $126,000 - 15% discount)

**Limits:**
- Hasta 3 ubicaciones
- Hasta 3 promociones activas
- 2 usuarios (team members)

**Features:**
- Analítica básica
- Soporte por email
- Redemption tracking
- Standard listing in app
- Team management (2 users)

---

### Plan Pro ⭐ (Most Popular)
**Monthly**: $270,000 COP
**Annual**: $2,754,000 COP (saves $486,000 - 15% discount)

**Limits:**
- Hasta 10 ubicaciones
- Hasta 10 promociones activas
- 5 usuarios (team members)

**Features:**
- **Segmentación de audiencia** (target by rank, location, etc.)
- **Analítica avanzada** (conversion rates, demographics, revenue attribution)
- Soporte prioritario
- Redemption tracking with advanced filters
- Enhanced listing visibility in app
- Team management (5 users with granular permissions)

---

### Plan Enterprise
**Monthly**: From $800,000 COP
**Annual**: From $8,160,000 COP (saves $1,440,000 - 15% discount)

**Limits:**
- Ubicaciones **ilimitadas**
- Promociones **ilimitadas**
- 10 usuarios (team members)

**Features:**
- **Negocio destacado en la App** (premium badge, top of search results)
- **Promociones destacadas en la App** (featured carousel placement)
- **Segmentación de audiencia** (advanced targeting)
- **Analítica avanzada** (full cohort analysis, heatmaps, benchmarks)
- Precio personalizado para cadenas y franquicias
- Soporte prioritario
- Custom campaigns
- Bulk operations
- Acceso para 10 usuarios

---

## Feature Comparison Matrix

| Feature | Gratis | Básico | Pro | Enterprise |
|---------|--------|--------|-----|------------|
| **Locations** | 1 | 3 | 10 | Unlimited |
| **Active Promotions** (per business) | Pay-per-promo | 3 | 10 | Unlimited |
| **Cost per Promotion** | $11,900 | Included | Included | Included |
| **Users/Team Members** | 1 | 2 | 5 | 10 |
| **Analytics** | Basic | Basic | Advanced | Advanced |
| **Audience Segmentation** | ❌ | ❌ | ✅ | ✅ |
| **Featured Business** | ❌ | ❌ | ❌ | ✅ |
| **Featured Promotions** | ❌ | ❌ | ❌ | ✅ |
| **Support** | Email | Email | Priority | Priority |
| **Annual Discount** | N/A | 15% | 15% | 15% |

---

## Trial Offer & Early Bird (Dashboard-Only Display)

### Trial Offer
- **Cost**: $7,140 COP (one-time payment made on marketing website)
- **Access**: Full Enterprise plan until Feb 1, 2026
- **After Trial**: Businesses must select a regular plan (Gratis, Básico, Pro, or Enterprise)

### Early Bird Incentive (DASHBOARD-ONLY - Do NOT show on marketing website)
- **Discount**: 50% off first month
- **Deadline**: January 15, 2026
- **Applies to**: Básico, Pro, and Enterprise plans only
- **Display**: Show badge/banner in dashboard plan selection page ONLY if `isEarlyBirdActive()` returns true
- **Application**: Automatically applied at checkout if before deadline

**IMPORTANT**: The marketing website does NOT display early bird promotions to keep messaging simple and fair for all trial sign-ups. Early bird is ONLY shown in the dashboard when businesses are selecting their post-trial plan.

---

## Development Commands

### Build and Development
- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run lint` - Run ESLint
- `npm start` - Start production server

### Firebase Integration
This project uses Firebase for authentication, database, and storage. Firebase emulators should be used for development. The Firebase configuration is in `/lib/firebase.ts` and requires environment variables to be set.

---

## Architecture Overview

### Project Structure
This is a **Next.js 14 application** with **App Router** serving as a dual-purpose dashboard for Heroes Colombia.

### Two Primary User Flows

#### Business Dashboard (`/app/business/dashboard/`)
- **Authentication**: Business owners log in and manage their company profiles
- **Core Pages**:
  - `/locations` - Manage physical and/or online business locations
  - `/team` - Invite and manage team members with role-based permissions (enforces plan limits)
  - `/promotions` - Create and manage promotions (enforces plan limits)
  - `/redemptions` - Process and track promotion redemptions
  - `/analytics` - View performance metrics (basic or advanced based on plan)
  - `/billing` - Manage subscription, view invoices, upgrade/downgrade
  - `/settings` - Business profile, notification preferences, account settings
- **Layout**: Uses `/app/business/dashboard/layout.tsx` with navigation sidebar

#### Admin Dashboard (`/app/admin/dashboard/`)
- **Authentication**: Platform administrators with elevated permissions
- **Core Pages**:
  - `/businesses` - Approve/manage all business accounts
  - `/users` - Military user verification queue
  - `/promotions` - Content moderation for all promotions
  - `/plans` - Manage plan configurations and pricing
  - `/settings` - Platform-wide settings
- **Layout**: Uses `/app/admin/dashboard/layout.tsx` with admin-specific navigation

### Data Architecture

#### Type System (`/lib/types.ts`)
- **Comprehensive TypeScript interfaces** for all business entities
- **Role-based access control**: UserRole, BusinessPermission, AdminPermission
- **Plan types**: "gratis" | "basico" | "pro" | "enterprise" with feature differentiation
- **Firebase integration**: Uses Timestamp types for dates

#### Firebase Schema
```
users/{userId} - User profiles and authentication
businesses/{businessId}/ - Business profiles
├── locations/{locationId} - Physical/online business locations
├── team_members/{memberId} - Team invitations and permissions
├── promotions/{promotionId} - Business promotions
├── redemptions/{redemptionId} - Transaction records
└── analytics/{analyticsId} - Performance metrics
```

#### Security Model
- **Firebase Custom Claims** for role-based access (owner, manager, staff, admin)
- **Tenant isolation** - all business data segregated by businessId
- **Security rules** in `/firestore.rules` using custom claims for performance
- **Plan-based feature limiting** enforced in UI components

---

## Plan Enforcement & Feature Limiting

### Critical Implementation Rules

**MUST enforce these limits throughout the dashboard:**

```typescript
// Example plan limits configuration (CREATE THIS FILE: lib/plan-limits.ts)
export const PLAN_LIMITS = {
  gratis: {
    maxLocations: 1,
    maxPromotions: null, // Pay-per-promotion, no hard limit
    maxUsers: 1,
    analyticsLevel: 'basic',
    audienceSegmentation: false,
    featuredBusiness: false,
    featuredPromotions: false,
    support: 'email',
  },
  basico: {
    maxLocations: 3,
    maxPromotions: 3,
    maxUsers: 2,
    analyticsLevel: 'basic',
    audienceSegmentation: false,
    featuredBusiness: false,
    featuredPromotions: false,
    support: 'email',
  },
  pro: {
    maxLocations: 10,
    maxPromotions: 10,
    maxUsers: 5,
    analyticsLevel: 'advanced',
    audienceSegmentation: true,
    featuredBusiness: false,
    featuredPromotions: false,
    support: 'priority',
  },
  enterprise: {
    maxLocations: Infinity,
    maxPromotions: Infinity,
    maxUsers: 10,
    analyticsLevel: 'enterprise',
    audienceSegmentation: true,
    featuredBusiness: true,
    featuredPromotions: true,
    support: 'dedicated',
  },
}
```

### UI Enforcement Patterns

**1. Location Creation** (`/app/business/dashboard/locations/page.tsx`)
```typescript
// Before showing "Add Location" button:
const canAddLocation = currentLocations.length < PLAN_LIMITS[userPlan].maxLocations

{canAddLocation ? (
  <Button onClick={openLocationForm}>Add Location</Button>
) : (
  <UpgradePlanButton
    message="You've reached your location limit. Upgrade to add more."
    currentPlan={userPlan}
  />
)}
```

**2. Promotion Creation** (`/app/business/dashboard/promotions/page.tsx`)
```typescript
// Count promotions PER location
const activePromotionsAtLocation = promotions.filter(
  p => p.locationId === selectedLocation && p.status === 'active'
).length

const limit = PLAN_LIMITS[userPlan].maxPromotions
const canAddPromotion = limit === null || activePromotionsAtLocation < limit

// For Gratis plan: Show payment modal before creating promotion
if (userPlan === 'gratis') {
  // Charge $11,900 COP per promotion via Mercado Pago
  await processPromotionPayment(11900)
}
```

**3. Team Management** (`/app/business/dashboard/team/page.tsx`)
```typescript
const canInviteUser = teamMembers.length < PLAN_LIMITS[userPlan].maxUsers

{!canInviteUser && (
  <Alert>
    You've reached your team limit ({PLAN_LIMITS[userPlan].maxUsers} users).
    <UpgradeLink plan={userPlan} />
  </Alert>
)}
```

**4. Analytics Access** (`/app/business/dashboard/analytics/page.tsx`)
```typescript
const analyticsLevel = PLAN_LIMITS[userPlan].analyticsLevel

// Only show advanced features to Pro+ plans
{analyticsLevel !== 'basic' && (
  <>
    <ConversionRateChart />
    <UserDemographics />
    <RevenueAttribution />
  </>
)}

// Only show enterprise features to Enterprise plan
{analyticsLevel === 'enterprise' && (
  <>
    <CohortAnalysis />
    <Heatmap />
    <BenchmarkData />
  </>
)}
```

**5. Audience Segmentation** (Promotion Form)
```typescript
const canSegment = PLAN_LIMITS[userPlan].audienceSegmentation

{canSegment ? (
  <AudienceSegmentationForm />
) : (
  <LockedFeature
    feature="Audience Segmentation"
    availableOn={['pro', 'enterprise']}
  />
)}
```

---

## Billing & Plan Selection

### Plan Selection Page (`/app/business/dashboard/billing/select-plan/page.tsx`)

**MUST IMPLEMENT:**
- Display all 4 plans (Gratis, Básico, Pro, Enterprise) with exact pricing from above
- Show monthly/annual toggle with 15% annual discount calculation
- **Display Early Bird badge ONLY if `isEarlyBirdActive()` returns true**
- Show current plan with "Current Plan" badge
- Disable downgrade if it would exceed limits (e.g., can't downgrade to Básico if business has 5 locations)
- Integration with Mercado Pago payment gateway for plan changes

**Early Bird Display Example:**
```typescript
import { isEarlyBirdActive, getEarlyBirdDiscount } from '@/lib/pricing-config'

export default function SelectPlanPage() {
  const showEarlyBird = isEarlyBirdActive()
  const discount = getEarlyBirdDiscount()

  return (
    <div>
      {showEarlyBird && (
        <Banner>
          ⚡ ¡Oferta Especial! Selecciona tu plan antes del 15 de enero
          y obtén {discount}% de descuento en tu primer mes.
        </Banner>
      )}

      {/* Plan cards with pricing */}
      <PlanCard plan="basico">
        {showEarlyBird && <Badge>🎁 {discount}% OFF primer mes</Badge>}
      </PlanCard>
    </div>
  )
}
```

### Billing Page (`/app/business/dashboard/billing/page.tsx`)

**MUST SHOW:**
- Current plan details
- Billing cycle (monthly/annual)
- Next billing date
- Payment method
- Invoice history
- Usage metrics vs. plan limits
- Upgrade/downgrade options
- Cancel subscription option (downgrades to Gratis)

---

## UI Component System

### Design Framework
- **Radix UI** + **Tailwind CSS** for component primitives
- **Consistent patterns**: All dashboard pages follow the same card-based layout
- **Colombian localization**: Currency (COP), Spanish text, local business categories
- **Responsive design**: Desktop-first with mobile considerations

### Form Handling
- **React Hook Form** + **Zod** for validation (`/lib/validations.ts`)
- **Spanish error messages** and local business rule validation
- **Plan limit enforcement** in form components with upgrade prompts

### Key Reusable Components to Create

**1. `<UpgradePlanButton />` Component**
```typescript
// components/upgrade-plan-button.tsx
interface UpgradePlanButtonProps {
  message: string
  currentPlan: PlanType
  recommendedPlan?: PlanType
  feature?: string
}

// Shows upgrade CTA when feature is locked
// Links to /business/dashboard/billing/select-plan
```

**2. `<PlanLimitBadge />` Component**
```typescript
// components/plan-limit-badge.tsx
interface PlanLimitBadgeProps {
  current: number
  max: number | 'unlimited'
  resourceType: 'locations' | 'promotions' | 'users'
  plan: PlanType
}

// Example: "2/3 Locations" with progress bar
// Shows warning when approaching limit
```

**3. `<LockedFeature />` Component**
```typescript
// components/locked-feature.tsx
interface LockedFeatureProps {
  feature: string
  availableOn: PlanType[]
  description?: string
}

// Shows lock icon + upgrade CTA for premium features
// Used for audience segmentation, advanced analytics, etc.
```

---

## Key Features

### Business Management

#### Location Management (`/app/business/dashboard/locations/`)
- Create/edit physical addresses with Google Maps integration
- Online stores with delivery zone configuration
- Business hours management (7-day schedule)
- **ENFORCE**: Max locations based on plan

#### Team Management (`/app/business/dashboard/team/`)
- Role-based invitations (owner/manager/staff)
- Granular permissions per team member
- Invitation workflow with email notifications
- **ENFORCE**: Max users based on plan

#### Promotion System (`/app/business/dashboard/promotions/`)
- Multiple promotion types: percentage, fixed amount, BOGO, free shipping
- Scheduling (start/end dates)
- Location targeting
- **ENFORCE**: Max active promotions based on the selected plan
- **ENFORCE**: Audience segmentation only for Pro+ plans
- **ENFORCE**: Pay $11,900 per promotion for Gratis plan

#### Redemption Processing (`/app/business/dashboard/redemptions/`)
- Manual check-in system
- Military ID verification
- QR code scanning
- Transaction tracking with notes
- Export redemption reports

### Analytics

#### Basic Analytics (Gratis & Básico)
- Total impressions
- Total views
- Total favourites
- Simple line chart of redemptions over time
- Top performing promotions

#### Advanced Analytics (Pro & Enterprise)
- Everything in Basic, PLUS:
- Conversion rate analysis
- Revenue attribution
- User demographics (age groups, military ranks, cities)
- Funnel analysis
- Custom date ranges
- Advanced filters

#### Enterprise Analytics (Enterprise only)
- Everything in Advanced, PLUS:
- Cohort analysis with retention rates
- Heatmap of user interactions
- Benchmark data vs. industry averages
- Predictive analytics
- Custom reports

---

## Admin Operations

### User Verification Queue (`/app/admin/dashboard/users/`)
- Military document review
- Verification scoring system
- Approve/reject with notes and push notification to users
- Bulk operations

### Promotion Moderation (`/app/admin/dashboard/promotions/`)
- Content review for all business promotions
- Approve/reject with feedback
- Flagging system for violations
- Priority queue for Enterprise businesses

### Subscription Management (`/app/admin/dashboard/plans/`)
- View all business subscriptions
- Manual plan changes (refunds, adjustments)
- Usage analytics across all plans
- Churn analysis

### Platform Settings (`/app/admin/dashboard/settings/`)
- System-wide configuration
- Email templates
- Payment integration settings
- Notification rules

---

## Data Management

### Export Functionality (`/lib/export-utils.ts`)
- CSV exports for all data types with Colombian formatting
- Date range filtering
- Business summary reports
- **ENFORCE**: Export limits based on plan (e.g., Gratis: last 30 days only)

### Seed Data (`/lib/seed-data.ts`)
- Development mock data with realistic Colombian business scenarios
- Multi-business test data with different plans and statuses
- Complete relationship modeling across users, businesses, locations, promotions

---

## Payment Integration

### Mercado Pago Integration (`/lib/mercado-pago.ts`, `/lib/actions/payment.ts`)

**Use Cases:**
1. **Gratis Plan**: Charge $11,900 per promotion created
2. **Plan Upgrades**: Process monthly/annual subscription payments
3. **Trial to Paid**: Handle first plan selection after trial period

**Implementation:**
- Use Mercado Pago for one-time and recurring payments
- Webhook handling for payment confirmations
- Auto-upgrade/downgrade based on payment status
- Failed payment handling with grace period

---

## Important Dates & Timelines

- **Trial Period**: Businesses pay $7,140 COP on marketing website, get Enterprise access until Feb 1, 2026
- **Early Bird Deadline**: January 15, 2025 (50% off first month - dashboard-only)
- **Trial End Date**: February 1, 2026 - all trial businesses must select a regular plan
- **Grace Period**: 7 days after trial ends before downgrading to Gratis automatically

---

## Marketing Website Integration

### Data Flow Between Systems

1. **User Signs Up on Website** (heroes-colombia-website)
   - Pays $7,140 COP via MercadoPago
   - Email + business details collected
   - Systeme.io CRM tags: `trial-signup`, `trial-active`

2. **Website Webhook → Dashboard**
   - Create business record in Firebase
   - Set `plan: "enterprise"` and `planEndDate: "2026-02-01"`
   - Send welcome email with dashboard login instructions

3. **Business Logs into Dashboard**
   - Full Enterprise access until Feb 1, 2026
   - Banner shows: "Your trial ends on Feb 1, 2026. Select your plan before Jan 15 to get 50% off!"

4. **Trial Expiration Reminders**
   - Day 45: Reminder email + dashboard banner
   - Day 58: Urgent reminder (7 days left)
   - Day 61: Trial expired, plan selection required
   - Day 68: Auto-downgrade to Gratis if no plan selected

5. **Plan Selection**
   - User selects plan in dashboard
   - If before Jan 15: Apply 50% early bird discount automatically
   - Process payment via Mercado PAgo
   - Update Systeme.io tags: `paid-customer`, `early-bird` (if applicable)
   - Update Firebase: `plan`, `planStartDate`, `billingCycle`

### Shared Configuration

**CRITICAL**: Dashboard MUST use the same pricing configuration as the website.

**Option 1 (Recommended)**: Create shared npm package
- Publish `@heroes-colombia/pricing-config` to private npm registry
- Import in both website and dashboard
- Single source of truth for all pricing

**Option 2**: Duplicate configuration files
- Copy `/lib/pricing-config.ts` from website to dashboard
- Keep them in sync manually (use version comments)
- Document synchronization process in both READMEs

---

## Environment Variables

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=heroes-cd74a
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Firebase Admin (Server-side) - required by /api/admin/* routes.
# NEVER commit a serviceAccountKey.json; Google scans public repos and disables
# any key it finds, which breaks every server-side Firebase call.
# Project id falls back to NEXT_PUBLIC_FIREBASE_PROJECT_ID, so only these two are needed:
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@heroes-cd74a.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# Alternative to the three vars above: the whole service account JSON
# (raw or base64-encoded) in a single var.
# FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=TEST-xxx (or APP_USR-xxx for production)
MERCADOPAGO_WEBHOOK_SECRET=xxx (get after creating webhook)

# URLs
NEXT_PUBLIC_DASHBOARD_URL=https://app.heroescolombia.com
NEXT_PUBLIC_WEBSITE_URL=https://heroescolombia.com

# CRM
SYSTEME_IO_API_KEY=xxx
```

---

## Development Context

### MVP Implementation Status
- **Phase 1 COMPLETED**: Business Dashboard core functionality
- **Phase 2.1 COMPLETED**: Admin Dashboard (user verification, promotion moderation)
- **Phase 2.2 IN PROGRESS**: Plan enforcement and billing integration
- **Next Phase**: Enhanced analytics with charts, early bird promotion flow

### Critical TODOs for Dashboard

**HIGH PRIORITY:**
1. ✅ Create `/lib/plan-limits.ts` with exact limits from website
2. ✅ Implement `<UpgradePlanButton />`, `<PlanLimitBadge />`, `<LockedFeature />` components
3. ✅ Enforce location limits in `/app/business/dashboard/locations/page.tsx`
4. ✅ Enforce promotion limits in `/app/business/dashboard/promotions/page.tsx`
5. ✅ Enforce team member limits in `/app/business/dashboard/team/page.tsx`
6. ✅ Create plan selection page at `/app/business/dashboard/billing/select-plan/page.tsx`
7. ✅ Implement early bird banner (dashboard-only, conditional on `isEarlyBirdActive()`)
8. ✅ Integrate Mercado Pago for plan payments and Gratis promotion payments
9. ✅ Add analytics tier restrictions (basic vs advanced vs enterprise)
10. ✅ Implement trial expiration logic and auto-downgrade to Gratis

**MEDIUM PRIORITY:**
11. Add usage dashboards showing current vs. max for each resource
12. Implement webhook from website to create business records
13. Build email templates for trial reminders
14. Create admin tools for manual plan adjustments
15. Add billing invoice generation and history

**LOW PRIORITY:**
16. API access for Enterprise customers
17. White-label options for Enterprise
18. Dedicated account manager portal
19. Benchmark data collection for enterprise analytics

---

## Architectural Decisions

1. **Firebase Custom Claims over Firestore RBAC** - Better performance and security
2. **Plan-based feature limiting** - All UI components respect subscription boundaries
3. **Tenant isolation pattern** - Strict data segregation by businessId
4. **Spanish-first localization** - All user-facing text adapted for Colombia
5. **Website as source of truth** - Dashboard inherits all pricing and features from marketing site

---

## Code Patterns to Follow

### Page Structure
Follow `/app/business/dashboard/locations/page.tsx` for layout consistency:
- Use card-based layouts
- Show plan limits clearly at top of page
- Include upgrade CTAs when limits are reached
- Use loading states and error boundaries

### Type Safety
- Use interfaces from `/lib/types.ts`
- Avoid `any` types
- Use strict TypeScript configuration

### Form Validation
- Use Zod schemas from `/lib/validations.ts`
- Spanish error messages
- Client and server-side validation

### Plan Enforcement
- Check user plan before showing premium features
- Show upgrade prompts for locked features
- Disable actions that would exceed plan limits
- Provide clear messaging about plan benefits

### Export Integration
- Use utilities from `/lib/export-utils.ts`
- Apply plan-based export restrictions
- Format Colombian currency and dates correctly

---

## Testing Strategy

### Test Plan Enforcement
```typescript
// Example test for location limits
describe('Location Creation', () => {
  it('blocks creation when limit reached for Básico plan', async () => {
    const business = createMockBusiness({ plan: 'basico' })
    const locations = createMockLocations(3) // At limit

    const result = await canAddLocation(business, locations)
    expect(result).toBe(false)
  })

  it('allows unlimited locations for Enterprise plan', async () => {
    const business = createMockBusiness({ plan: 'enterprise' })
    const locations = createMockLocations(100) // Way over other plan limits

    const result = await canAddLocation(business, locations)
    expect(result).toBe(true)
  })
})
```

### Integration Tests
- Test plan upgrade flow end-to-end
- Test Gratis pay-per-promotion workflow
- Test early bird discount application
- Test trial expiration and auto-downgrade

---

## Authentication Context

The app uses a custom `AuthProvider` (`/hooks/use-auth`) that wraps Firebase Auth and provides user context throughout the application. Pages automatically redirect based on user role and authentication status.

**User Context Includes:**
- User profile (email, name, role)
- Business profile (name, plan, status)
- Plan limits (locations, promotions, users)
- Feature flags (audienceSegmentation, featuredBusiness, etc.)

---

## Summary: Dashboard Must Match Website

**Critical Alignment Points:**

| Aspect | Website Promise | Dashboard Must Deliver |
|--------|-----------------|----------------------|
| **Plans** | Gratis, Básico, Pro, Enterprise | Same 4 plans with identical names |
| **Pricing** | $0, $70k, $270k, $800k monthly | Exact same pricing in billing |
| **Locations** | 1, 3, 10, Unlimited | Enforce these exact limits |
| **Promotions/Location** | Pay-per, 3, 10, Unlimited | Enforce these exact limits |
| **Users** | 1, 2, 5, 10 | Enforce these exact limits |
| **Analytics** | Basic, Basic, Advanced, Advanced | Show correct analytics tier |
| **Segmentation** | No, No, Yes, Yes | Enable only for Pro+ |
| **Featured** | No, No, No, Yes | Show featured badges only for Enterprise |
| **Support** | Email, Email, Priority, Priority | Provide documented support levels |
| **Annual Discount** | 15% all plans | Calculate and apply 15% discount |
| **Early Bird** | Not shown | Show ONLY in dashboard before Jan 15 |

---

**Next Steps for Implementation:**

1. Copy `/lib/pricing-config.ts` from website to dashboard
2. Create `/lib/plan-limits.ts` with enforcement logic
3. Build plan selection page with early bird support
4. Add limit checks to all resource creation flows
5. Create upgrade/locked feature UI components
6. Integrate Mercado Pago for payments
7. Test end-to-end trial → plan selection → billing cycle

This ensures both systems are perfectly aligned and businesses receive exactly what was promised on the marketing website.

---

## Recent Updates & Implementation Status

### November 2024 - Locations & Promotions Enhancement

#### ✅ Locations Page - Full CRUD Implementation
**File**: `/app/business/dashboard/locations/page.tsx`

**Features Implemented:**
1. **Edit Functionality**:
   - Single dialog for both create and edit modes
   - Pre-populates form data when editing
   - Supports changing location type (physical ↔ online)
   - Google Maps integration for coordinate updates
   - Primary location switching during edit

2. **Delete Functionality**:
   - Custom confirmation dialog with safety checks
   - Prevents deletion of primary location
   - Prevents deletion of last location
   - Checks for active promotions before allowing deletion
   - Blocks deletion if location has active promotions

3. **UI/UX Improvements**:
   - **Prominent Primary Indicator**: Crown icon (👑) with "SEDE PRINCIPAL" badge
   - **Visual Highlighting**: Yellow background and border for primary location
   - **Tooltips**: Hover tooltips on disabled delete button explaining why it's disabled
   - **Responsive Design**: Mobile-friendly grids (`grid-cols-1 sm:grid-cols-2`)

**Safety Checks**:
```typescript
// Cannot delete if:
1. location.isPrimary === true  // Primary location protection
2. locations.length === 1       // Last location protection
3. Has active promotions        // Promotion dependency check
```

#### ✅ Promotions Page - Location Targeting Bug Fix
**File**: `/app/business/dashboard/promotions/page.tsx`

**Bug Fixed**:
- **Issue**: When editing a promotion with "All locations" selected, individual location checkboxes were disabled
- **Root Cause**: `disabled={formData.locationIds.length === 0 || isSubmitting}`
- **Solution**: Removed incorrect condition, now only disables during submission
- **Impact**: Users can now freely switch between "All locations" and specific locations when editing

**Code Change**:
```typescript
// Before (BROKEN)
disabled={formData.locationIds.length === 0 || isSubmitting}

// After (FIXED)
disabled={isSubmitting}
```

### Page-by-Page Implementation Status

| Page | Create | Edit | Delete | Filters | Plan Limits | Status |
|------|--------|------|--------|---------|-------------|--------|
| **Locations** | ✅ | ✅ | ✅ | ✅ (type, search) | ✅ | **Complete** |
| **Promotions** | ✅ | ✅ | ✅ | ✅ (status, search) | ✅ | **Complete** |
| **Team** | ✅ | ✅ | ✅ | ❌ | ✅ | Needs filters |
| **Redemptions** | ✅ | ❌ | ❌ | ✅ | N/A | View-only |
| **Analytics** | N/A | N/A | N/A | ✅ | ✅ | View-only |
| **Billing** | N/A | ✅ | N/A | N/A | N/A | Functional |

### Component Reusability Pattern

**Single Dialog Pattern** (Recommended):
```typescript
// State management
const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
const [editingId, setEditingId] = useState<string | null>(null)
const [formData, setFormData] = useState({ /* initial values */ })

// Open create
const handleOpenCreate = () => {
  resetForm()
  setDialogMode('create')
  setEditingId(null)
  setIsDialogOpen(true)
}

// Open edit
const handleOpenEdit = (item) => {
  setFormData({ /* populate from item */ })
  setDialogMode('edit')
  setEditingId(item.id)
  setIsDialogOpen(true)
}

// Save handler
const handleSave = async () => {
  if (dialogMode === 'create') {
    await createItem(formData)
  } else {
    await updateItem(editingId, formData)
  }
}
```

**Benefits**:
- Less code duplication
- Consistent UX between create/edit
- Single source of truth for form validation
- Easier maintenance

### Tooltip Implementation

**Native Browser Tooltips** (Using `title` attribute):
```typescript
<Button
  variant="ghost"
  size="icon"
  disabled={location.isPrimary}
  title={
    location.isPrimary
      ? "No puedes eliminar la ubicación principal. Marca otra ubicación como principal primero."
      : "Eliminar ubicación"
  }
>
  <Trash2 className="h-4 w-4" />
</Button>
```

**Why Native Tooltips?**:
- ✅ No additional dependencies
- ✅ Accessible by default
- ✅ Works on mobile (long press)
- ✅ Consistent across browsers
- ✅ Zero bundle size impact

### Responsive Design Patterns Used

```typescript
// Header - stacks on mobile
className="flex flex-col sm:flex-row sm:items-center gap-4"

// Filters - vertical on mobile, horizontal on desktop
className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4"

// Contact grid - 1 column mobile, 2 columns tablet+
className="grid grid-cols-1 sm:grid-cols-2 gap-4"

// Location cards - vertical mobile, horizontal desktop
className="flex flex-col md:flex-row md:items-start gap-4"
```

### Firebase Service Best Practices

**Location Service Example**:
```typescript
// Always return IDs with data
const locations = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}))

// Handle errors gracefully
try {
  await deleteLocation(businessId, locationId)
  return true
} catch (error) {
  console.error('Error deleting location:', error)
  return false
}

// Use optimistic updates
setLocations(prev => prev.filter(loc => loc.id !== deletingId))
```

---

## Project Structure Overview (Simplified)

```
heroes-colombia-dashboard/
├── app/
│   ├── business/dashboard/
│   │   ├── page.tsx                    # Dashboard home
│   │   ├── locations/page.tsx          # ✅ CRUD + Delete Safety
│   │   ├── promotions/page.tsx         # ✅ CRUD + Bug Fixed
│   │   ├── team/page.tsx              # CRUD (needs filters)
│   │   ├── redemptions/page.tsx       # View + Process
│   │   ├── analytics/page.tsx         # View + Charts
│   │   ├── billing/page.tsx           # Subscription mgmt
│   │   └── settings/page.tsx          # Profile edit
│   └── admin/dashboard/               # Admin tools
│
├── components/
│   ├── ui/                            # shadcn components
│   ├── location-picker-modal.tsx      # ✅ Google Maps picker
│   ├── plan-limit-badge.tsx           # Usage indicators
│   └── upgrade-plan-button.tsx        # Upgrade CTAs
│
├── lib/
│   ├── services/
│   │   ├── location-service.ts        # ✅ CRUD complete
│   │   ├── promotion-service.ts       # ✅ CRUD complete
│   │   ├── user-service.ts
│   │   ├── analytics-service.ts
│   │   └── ...
│   ├── firebase.ts                    # Config
│   ├── firebase-storage.ts            # Upload utils
│   ├── plan-limits.ts                 # Enforcement
│   └── types.ts                       # TypeScript defs
│
└── hooks/
    └── use-auth.ts                    # Auth context
```

### Key Files to Reference

When implementing new features, use these as templates:

1. **CRUD Pages**: `/app/business/dashboard/locations/page.tsx`
2. **Services**: `/lib/services/location-service.ts`
3. **Dialogs**: Location create/edit dialog (single dialog pattern)
4. **Delete Confirmations**: Location delete dialog
5. **Responsive Layouts**: Locations page responsive patterns

---

**Last Updated**: November 10, 2024
**Major Changes**: Locations CRUD complete, Promotions bug fixed, Tooltips added, Primary location visual enhancement
