import { useEffect, useState } from 'react';
import { Disc, ListMusic, Music, User } from 'lucide-react';
import { resolveArtwork } from '@/services/music/artworkResolver';

interface ArtworkImageProps {
  src?: string;
  alt: string;
  type: 'album' | 'artist' | 'track' | 'playlist';
  title: string;
  artist?: string;
  className?: string;
  iconClassName?: string;
}

export function ArtworkImage({
  src,
  alt,
  type,
  title,
  artist,
  className = 'w-full h-full object-cover',
  iconClassName = 'w-8 h-8 text-white/25',
}: ArtworkImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | undefined>(src || undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setResolvedSrc(src || undefined);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if ((resolvedSrc && !failed) || !title) return;
    let cancelled = false;
    resolveArtwork({ type, title, artist }).then((url) => {
      if (!cancelled && url) {
        setResolvedSrc(url);
        setFailed(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [resolvedSrc, failed, type, title, artist]);

  if (resolvedSrc && !failed) {
    return (
      <img
        src={resolvedSrc}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  if (type === 'artist') return <User className={iconClassName} />;
  if (type === 'album') return <Disc className={iconClassName} />;
  if (type === 'playlist') return <ListMusic className={iconClassName} />;
  return <Music className={iconClassName} />;
}

export default ArtworkImage;
