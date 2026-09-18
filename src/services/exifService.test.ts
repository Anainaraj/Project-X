import { describe, expect, it } from 'vitest'
import {
  applyHemisphere,
  dmsToDecimal,
  parseGpsFromTags,
  parseGpsTimestampFromTags,
} from './exifService'

describe('dmsToDecimal', () => {
  it('converts degrees/minutes/seconds to decimal degrees', () => {
    // 50°17'58.57" -> 50.29960...
    expect(dmsToDecimal([50, 17, 58.57])).toBeCloseTo(50.2996, 4)
  })
})

describe('applyHemisphere', () => {
  it('keeps North and East positive', () => {
    expect(applyHemisphere(50.3, 'N')).toBeCloseTo(50.3)
    expect(applyHemisphere(14.4, 'E')).toBeCloseTo(14.4)
  })

  it('negates South and West', () => {
    expect(applyHemisphere(50.3, 'S')).toBeCloseTo(-50.3)
    expect(applyHemisphere(14.4, 'W')).toBeCloseTo(-14.4)
  })
})

describe('parseGpsFromTags', () => {
  it('parses a valid image with GPS data (Prague, roughly 50.2996 N, 14.4 E)', () => {
    const result = parseGpsFromTags({
      GPSLatitude: [50, 17, 58.57],
      GPSLatitudeRef: 'N',
      GPSLongitude: [14, 24, 2.02],
      GPSLongitudeRef: 'E',
    })

    expect(result).not.toBeNull()
    expect(result!.latitude).toBeCloseTo(50.2996, 3)
    expect(result!.longitude).toBeCloseTo(14.4006, 3)
  })

  it('applies negative signs for southern/western hemispheres', () => {
    const result = parseGpsFromTags({
      GPSLatitude: [33, 51, 35.9],
      GPSLatitudeRef: 'S',
      GPSLongitude: [151, 12, 40],
      GPSLongitudeRef: 'E',
    })

    expect(result!.latitude).toBeLessThan(0)
    expect(result!.longitude).toBeGreaterThan(0)
  })

  it('returns null for an image without GPS data', () => {
    expect(parseGpsFromTags({})).toBeNull()
  })

  it('returns null for malformed GPS tags (wrong shape)', () => {
    expect(
      parseGpsFromTags({
        GPSLatitude: 'not-an-array',
        GPSLatitudeRef: 'N',
        GPSLongitude: [14, 24, 2.02],
        GPSLongitudeRef: 'E',
      }),
    ).toBeNull()
  })

  it('returns null for out-of-range coordinates (corrupt EXIF)', () => {
    expect(
      parseGpsFromTags({
        GPSLatitude: [200, 0, 0],
        GPSLatitudeRef: 'N',
        GPSLongitude: [14, 24, 2.02],
        GPSLongitudeRef: 'E',
      }),
    ).toBeNull()
  })
})

describe('parseGpsTimestampFromTags', () => {
  it('combines GPSDateStamp and GPSTimeStamp as a UTC timestamp', () => {
    const result = parseGpsTimestampFromTags({
      GPSDateStamp: '2024:06:15',
      GPSTimeStamp: [14, 30, 5],
    })

    expect(result).not.toBeNull()
    expect(result!.toISOString()).toBe('2024-06-15T14:30:05.000Z')
  })

  it('returns null when GPS timestamp tags are absent', () => {
    expect(parseGpsTimestampFromTags({})).toBeNull()
  })

  it('returns null for a malformed date stamp', () => {
    expect(
      parseGpsTimestampFromTags({
        GPSDateStamp: 'not-a-date',
        GPSTimeStamp: [14, 30, 5],
      }),
    ).toBeNull()
  })
})
