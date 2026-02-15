'use client';

import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import iconPng from '../../../public/images/icon.png';

/**
 * Logo for docs sidebar header.
 * Unlike PlatformLogo, this doesn't include a Link wrapper
 * because Fumadocs already wraps nav.title in a Link.
 */
export function DocsLogo({ label = 'Docs' }: { label?: string }) {
   const [mounted, setMounted] = useState(false);

   useEffect(() => {
      setMounted(true);
   }, []);

   return (
      <div className="flex items-center gap-2">
         {mounted ? (
            <Image src={iconPng} alt="FIDE Logo" width={28} height={28} />
         ) : (
            <div className="w-[28px] h-[28px]" />
         )}
         <span className="text-xl font-bold">FIDE</span>
         <Badge variant="secondary" className="text-sm font-bold px-1.5 py-.5">
            {label}
         </Badge>
      </div>
   );
}
