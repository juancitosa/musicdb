import Footer from "./Footer";
import Navbar from "./Navbar";

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/30 selection:text-primary">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
