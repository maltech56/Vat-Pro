import {
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-white pt-20 pb-10">

      <div className="max-w-7xl mx-auto px-6">

        <div className="grid lg:grid-cols-4 gap-12 mb-16">

          {/* BRAND */}
          <div>

            <div className="flex items-center gap-3 mb-6">

              <div className="w-12 h-12 rounded-xl bg-cyan-600"></div>

              <div>

                <h3 className="text-2xl font-bold">
                  Maltech VAT Pro
                </h3>

                <p className="text-slate-400 text-sm">
                  VAT Compliance Platform
                </p>

              </div>

            </div>

            <p className="text-slate-400 leading-relaxed">
              Modern VAT compliance and audit-ready record management
              for Bahamian businesses.
            </p>

          </div>

          {/* QUICK LINKS */}
          <div>

            <h4 className="text-xl font-semibold mb-6">
              Quick Links
            </h4>

            <div className="space-y-4 text-slate-400">

              <a href="#features" className="block hover:text-white transition">
                Features
              </a>

              <a href="#pricing" className="block hover:text-white transition">
                Pricing
              </a>

              <a href="#faq" className="block hover:text-white transition">
                FAQ
              </a>

            </div>

          </div>

          {/* CONTACT */}
          <div>

            <h4 className="text-xl font-semibold mb-6">
              Contact
            </h4>

            <div className="space-y-5 text-slate-400">

              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-cyan-500" />
                <span>support@maltechenterprises.com</span>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-cyan-500" />
                <span>+1 (242) 000-0000</span>
              </div>

              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-cyan-500" />
                <span>Nassau, Bahamas</span>
              </div>

            </div>

          </div>

          {/* PLATFORM */}
          <div>

            <h4 className="text-xl font-semibold mb-6">
              Platform
            </h4>

            <div className="space-y-4 text-slate-400">

              <div>QuickBooks Integration</div>

              <div>Audit Ready Records</div>

              <div>Secure Cloud Storage</div>

              <div>Bahamian VAT Support</div>

            </div>

          </div>

        </div>

        {/* BOTTOM BAR */}

        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between gap-4 text-slate-500 text-sm">

          <div>
            © 2026 Maltech VAT Pro. All rights reserved.
          </div>

          <div>
            Built for Bahamian VAT Compliance
          </div>

        </div>

      </div>

    </footer>
  );
}