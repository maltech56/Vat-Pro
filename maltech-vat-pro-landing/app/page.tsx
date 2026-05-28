import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

import Hero from "../components/sections/Hero";
import Features from "../components/sections/Features";
import HowItWorks from "../components/sections/HowItWorks";
import Pricing from "../components/sections/Pricing";
import FAQ from "../components/sections/FAQ";
import Stats from "../components/sections/Stats";
import Testimonials from "../components/sections/Testimonials";
import Contact from "../components/sections/Contact";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />

      {/* <Stats /> */}
      {/* <Testimonials /> */}

      <Features />
      <HowItWorks />
      <Pricing />
      <Contact />
      <FAQ />
      <Footer />
    </main>
  );
}