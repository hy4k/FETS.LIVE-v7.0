// Session capacity validation utilities

interface CapacityValidationResult {
  isValid: boolean
  warning?: string
  error?: string
}

/**
 * Get branch-specific capacity limits
 * @param branch - Branch location ('calicut', 'cochin', or 'global')
 * @returns Maximum capacity for the branch
 */
export const getBranchCapacity = (branch: string = 'calicut'): number => {
  switch (branch.toLowerCase()) {
    case 'calicut':
      return 40
    case 'cochin':
      return 31
    case 'kannur':
      return 50
    default:
      return 40 // Default to Calicut capacity
  }
}

/**
 * Validate session capacity with warnings and errors
 * @param candidateCount - Number of candidates in session
 * @param branch - Branch location for capacity limits
 * @returns Validation result with warnings/errors
 */
export const validateSessionCapacity = (
  candidateCount: number,
  branch: string = 'calicut'
): CapacityValidationResult => {
  const MAX_CAPACITY = getBranchCapacity(branch)
  const WARNING_THRESHOLD = Math.floor(MAX_CAPACITY * 0.75) // 75% of capacity

  if (candidateCount > MAX_CAPACITY) {
    return {
      isValid: false,
      error: `Session exceeds maximum capacity of ${MAX_CAPACITY} candidates for ${branch.charAt(0).toUpperCase() + branch.slice(1)} center`
    }
  }

  if (candidateCount >= WARNING_THRESHOLD) {
    return {
      isValid: true,
      warning: `Session approaching capacity (${candidateCount}/${MAX_CAPACITY} candidates) for ${branch.charAt(0).toUpperCase() + branch.slice(1)} center`
    }
  }

  return { isValid: true }
}

/**
 * Get capacity status color class for UI
 * @param candidateCount - Number of candidates
 * @param branch - Branch location for capacity limits
 * @returns CSS color classes
 */
export const getCapacityStatusColor = (candidateCount: number, branch: string = 'calicut'): string => {
  const MAX_CAPACITY = getBranchCapacity(branch)
  const WARNING_THRESHOLD = Math.floor(MAX_CAPACITY * 0.75)

  if (candidateCount >= MAX_CAPACITY) return 'text-red-600 bg-red-100'
  if (candidateCount >= WARNING_THRESHOLD) return 'text-orange-600 bg-orange-100'
  return 'text-green-600 bg-green-100'
}

/**
 * Format capacity display text
 * @param candidateCount - Number of candidates
 * @param branch - Branch location for capacity limits
 * @returns Formatted display text
 */
export const formatCapacityDisplay = (candidateCount: number, branch: string = 'calicut'): string => {
  const MAX_CAPACITY = getBranchCapacity(branch)
  return `${candidateCount}/${MAX_CAPACITY} candidates`
}
