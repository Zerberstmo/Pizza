// Zutaten-Empfehlungen für den Konfigurator. Reine Funktion aus App.tsx:196-207.
export function getRecs(selected: string[]): Array<{ text: string; addId: string }> {
  const recs: Array<{ text: string; addId: string }> = [];
  if (selected.length > 0 && !selected.includes("mozzarella"))
    recs.push({ text: "Fast alle wählen dazu Mozzarella.", addId: "mozzarella" });
  if (selected.includes("schinken") && !selected.includes("rucola"))
    recs.push({ text: "Rucola passt perfekt zu Schinken.", addId: "rucola" });
  if (selected.includes("salami") && !selected.includes("jalapenos"))
    recs.push({ text: "Jalapeños machen Salami zum Erlebnis.", addId: "jalapenos" });
  if (selected.includes("thunfisch") && !selected.includes("zwiebeln"))
    recs.push({ text: "Zwiebeln runden Thunfisch klassisch ab.", addId: "zwiebeln" });
  return recs.slice(0, 2);
}
