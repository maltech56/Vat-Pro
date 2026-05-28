import {
  ShieldCheck,
  Calculator,
  FileText,
  Database,
} from "lucide-react";

export default function Features() {

  const features = [
    {
      title: "VAT Automation",
      description:
        "Automate VAT calculations and prepare compliant returns faster.",
      icon: Calculator,
    },

    {
      title: "Audit Ready",
      description:
        "Maintain organized records and secure digital audit trails.",
      icon: FileText,
    },

    {
      title: "Secure Storage",
      description:
        "Protect financial records with encrypted cloud infrastructure.",
      icon: ShieldCheck,
    },

    {
      title: "Data Integration",
      description:
        "Import QuickBooks, Excel, CSV, and PDF financial data easily.",
      icon: Database,
    },
  ];

  return (
    <section
      id="features"
      className="py-24 bg-white"
    >

      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">

          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Powerful VAT Compliance Features
          </h2>

          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Everything Bahamian businesses need to simplify VAT reporting and remain audit ready.
          </p>

        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">

          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (

              <div
                key={index}
                className="bg-slate-50 rounded-3xl p-8 border hover:shadow-2xl hover:-translate-y-2 transition duration-300"
              >

                <div className="w-16 h-16 rounded-2xl bg-cyan-100 flex items-center justify-center mb-6">

                  <Icon className="w-8 h-8 text-cyan-700" />

                </div>

                <h3 className="text-2xl font-semibold text-slate-900 mb-4">
                  {feature.title}
                </h3>

                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>

              </div>
            );
          })}

        </div>

      </div>
    </section>
  );
}