import exifr from 'exifr'

export interface GpsCoordinates {
  latitude: number
  longitude: number
}

export interface ExifData {
  /** Decimal-degree coordinates, or null if the image has no valid GPS tags. */
  gps: GpsCoordinates | null
  /** The camera's clock at the moment of capture (EXIF DateTimeOriginal). */
  captureTimestamp: Date | null
  /** The GPS receiver's own UTC fix time (EXIF GPSDateStamp + GPSTimeStamp) — not the same as captureTimestamp. */
  gpsTimestamp: Date | null
}

const EMPTY_EXIF: ExifData = { gps: null, captureTimestamp: null, gpsTimestamp: null }

interface RawExifTags {
  GPSLatitude?: unknown
  GPSLatitudeRef?: unknown
  GPSLongitude?: unknown
  GPSLongitudeRef?: unknown
  GPSDateStamp?: unknown
  GPSTimeStamp?: unknown
  DateTimeOriginal?: unknown
}

function isNumberTriplet(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((component) => typeof component === 'number' && Number.isFinite(component))
  )
}

/** Converts an EXIF [degrees, minutes, seconds] GPS component to decimal degrees. */
export function dmsToDecimal([degrees, minutes, seconds]: [number, number, number]): number {
  return degrees + minutes / 60 + seconds / 3600
}

/** South and West are negative; North and East are positive. Unknown refs are treated as positive. */
export function applyHemisphere(decimal: number, ref: unknown): number {
  return ref === 'S' || ref === 'W' ? -decimal : decimal
}

/**
 * Builds decimal-degree coordinates from raw EXIF GPS tags, or returns null
 * if the tags are missing, malformed, or out of a physically valid range.
 */
export function parseGpsFromTags(tags: RawExifTags): GpsCoordinates | null {
  const { GPSLatitude, GPSLatitudeRef, GPSLongitude, GPSLongitudeRef } = tags

  if (!isNumberTriplet(GPSLatitude) || !isNumberTriplet(GPSLongitude)) {
    return null
  }

  const latitude = applyHemisphere(dmsToDecimal(GPSLatitude), GPSLatitudeRef)
  const longitude = applyHemisphere(dmsToDecimal(GPSLongitude), GPSLongitudeRef)

  const isValidLatitude = Number.isFinite(latitude) && Math.abs(latitude) <= 90
  const isValidLongitude = Number.isFinite(longitude) && Math.abs(longitude) <= 180
  if (!isValidLatitude || !isValidLongitude) {
    return null
  }

  return { latitude, longitude }
}

/** GPS date/time tags are always UTC, and stored separately from the date. */
export function parseGpsTimestampFromTags(tags: RawExifTags): Date | null {
  const { GPSDateStamp, GPSTimeStamp } = tags

  if (typeof GPSDateStamp !== 'string' || !isNumberTriplet(GPSTimeStamp)) {
    return null
  }

  const dateParts = GPSDateStamp.split(':').map(Number)
  if (dateParts.length !== 3 || dateParts.some((part) => !Number.isFinite(part))) {
    return null
  }
  const [year, month, day] = dateParts
  const [hour, minute, second] = GPSTimeStamp

  const timestampMs = Date.UTC(year, month - 1, day, hour, minute, Math.floor(second))
  return Number.isFinite(timestampMs) ? new Date(timestampMs) : null
}

function parseCaptureTimestampFromTags(tags: RawExifTags): Date | null {
  return tags.DateTimeOriginal instanceof Date ? tags.DateTimeOriginal : null
}

/**
 * Reads GPS coordinates and capture timestamp from a photo's EXIF metadata.
 * Never throws: malformed or absent EXIF data resolves to an all-null
 * result rather than blocking the upload it accompanies.
 */
export async function extractExifData(file: File): Promise<ExifData> {
  try {
    const tags = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      pick: [
        'GPSLatitude',
        'GPSLatitudeRef',
        'GPSLongitude',
        'GPSLongitudeRef',
        'GPSDateStamp',
        'GPSTimeStamp',
        'DateTimeOriginal',
      ],
    })) as RawExifTags | undefined

    if (!tags) {
      return EMPTY_EXIF
    }

    return {
      gps: parseGpsFromTags(tags),
      captureTimestamp: parseCaptureTimestampFromTags(tags),
      gpsTimestamp: parseGpsTimestampFromTags(tags),
    }
  } catch {
    return EMPTY_EXIF
  }
}
