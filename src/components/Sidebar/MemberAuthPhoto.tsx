/**
 * MemberAuthPhoto (v398 AC3): sajian foto berotorisasi di sidebar.
 *
 * Elemen img tidak bisa membawa header Authorization, sehingga byte foto
 * dimuat via fetchMemberPhoto (Bearer) lalu dirender sebagai object URL
 * (di-revoke saat unmount/ganti). Gagal muat (401/403/404) jatuh jujur ke
 * inisial nama; foto tidak pernah tampil tanpa otorisasi yang sah.
 */
import React, { useEffect, useRef, useState } from 'react';
import { getMemberPhotoApi } from '../../lib/adapters';

interface Props {
  memberId: string;
  photoUrl: string | undefined;
  name: string;
}

export const MemberAuthPhoto: React.FC<Props> = ({ memberId, photoUrl, name }) => {
  const [src, setSrc] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const api = getMemberPhotoApi();
    if (api === null || !photoUrl) {
      setSrc(null);
      return;
    }
    api
      .fetchMemberPhoto(memberId)
      .then((bytes) => {
        if (!alive) return;
        if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
        objectUrlRef.current = url;
        setSrc(url);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [memberId, photoUrl]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  if (src === null) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl font-bold">
        {name.charAt(0)}
      </div>
    );
  }
  return <img src={src} alt={name} className="w-full h-full object-cover" data-testid="member-auth-photo" />;
};
