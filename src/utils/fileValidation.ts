export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export interface FileValidationResult {
  valid: boolean
  reason?: string
}

export function validateImageFile(file: File): FileValidationResult {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      reason: `"${file.name}" is not a supported image type. Please use JPEG, PNG, or WebP.`,
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
    const maxMb = MAX_FILE_SIZE_BYTES / (1024 * 1024)
    return {
      valid: false,
      reason: `"${file.name}" is ${sizeMb} MB, which is over the ${maxMb} MB limit.`,
    }
  }

  return { valid: true }
}
