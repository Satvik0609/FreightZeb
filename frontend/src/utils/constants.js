export const STATUS_COLORS = {
  PENDING:    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  OPTIMIZED:  'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  BOOKED:     'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  IN_TRANSIT: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  DELIVERED:  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  CANCELLED:  'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  REQUESTED:  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  APPROVED:   'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  ASSIGNED:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  PICKED_UP:  'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  REJECTED:   'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  PAID:       'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  OVERDUE:    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  ACTIVE:     'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  INACTIVE:   'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  AVAILABLE:  'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  ON_TRIP:    'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  MAINTENANCE:'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

export const TRUCK_TYPES = [
  { value: 'SMALL_VAN', label: 'Small Van' },
  { value: 'CONTAINER_20FT', label: 'Container 20ft' },
  { value: 'CONTAINER_32FT', label: 'Container 32ft' },
  { value: 'FLATBED_TRAILER', label: 'Flatbed Trailer' },
  { value: 'REEFER', label: 'Reefer' },
]

export const SHIPMENT_STATUSES = ['PENDING', 'OPTIMIZED', 'BOOKED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']
export const BOOKING_STATUSES = ['REQUESTED', 'APPROVED', 'REJECTED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED']
export const INVOICE_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']

export const WEATHER_OPTIONS = [
  { value: 'CLEAR', label: 'Clear' },
  { value: 'CLOUDY', label: 'Cloudy' },
  { value: 'RAIN', label: 'Rain' },
  { value: 'STORM', label: 'Storm' },
  { value: 'FOG', label: 'Fog' },
  { value: 'SNOW', label: 'Snow' },
]

export const TRAFFIC_OPTIONS = [
  { value: 'LIGHT', label: 'Light' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'HEAVY', label: 'Heavy' },
  { value: 'SEVERE', label: 'Severe' },
]

export const TIME_OF_DAY_OPTIONS = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'AFTERNOON', label: 'Afternoon' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'NIGHT', label: 'Night' },
]

export const CARGO_TYPES = [
  { value: 'GENERAL', label: 'General' },
  { value: 'PERISHABLE', label: 'Perishable' },
  { value: 'HAZARDOUS', label: 'Hazardous' },
  { value: 'FRAGILE', label: 'Fragile' },
]

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]

export const ROLES = ['ADMIN', 'WAREHOUSE', 'DEALER']

export const BOOKING_STEPS = [
  'REQUESTED',
  'APPROVED',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
]

export const TRUCK_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ON_TRIP', label: 'On Trip' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
]
