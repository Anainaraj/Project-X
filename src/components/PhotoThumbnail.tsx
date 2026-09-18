import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchFileBlob } from '../services/driveService'

interface PhotoThumbnailProps {
  fileId: string
  alt: string
}

type ThumbnailStatus = 'loading' | 'ready' | 'error'

export function PhotoThumbnail({ fileId, alt }: PhotoThumbnailProps) {
  const { getAccessToken } = useAuth()
  const [status, setStatus] = useState<ThumbnailStatus>('loading')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    setStatus('loading')
    setBlobUrl(null)

    async function load() {
      try {
        const accessToken = await getAccessToken()
        const blob = await fetchFileBlob(accessToken, fileId)
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fileId, getAccessToken])

  if (status === 'error') {
    return (
      <div className="photo-thumbnail photo-thumbnail--error" role="img" aria-label={`Could not load ${alt}`}>
        Could not load image
      </div>
    )
  }

  if (status === 'loading' || !blobUrl) {
    return <div className="photo-thumbnail photo-thumbnail--loading" aria-hidden="true" />
  }

  return <img className="photo-thumbnail" src={blobUrl} alt={alt} />
}
