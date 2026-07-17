// Datum/Uhrzeit in Europe/Berlin (DST-sicher über die IANA-Zone). Der Browser des Kunden kann in
// einer anderen Zone stehen — die Bestellung gehört aber immer in die Zeit des Ladens.
// hourCycle "h23" statt hour12:false: sonst liefern manche Locales "24" statt "00" für Mitternacht.
export function berlinDateTime(now: Date): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
