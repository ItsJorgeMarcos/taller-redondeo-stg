import Calendar from "@/components/Calendar";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="mb-4 text-xl font-semibold">Calendario Taller Redondeo</h1>
      <Calendar />
    </main>
  );
}
