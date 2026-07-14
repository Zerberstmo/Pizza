import type React from "react";
import { QRCodeSVG } from "qrcode.react";

// Echter, scanbarer QR-Code. `data` ist die zu kodierende URL.
export function QrCode({ data }: { data: string }): React.ReactElement {
  return (
    <QRCodeSVG
      value={data}
      size={256}
      level="M"
      bgColor="#ffffff"
      fgColor="#09090B"
      className="w-full h-full rounded-lg"
    />
  );
}
