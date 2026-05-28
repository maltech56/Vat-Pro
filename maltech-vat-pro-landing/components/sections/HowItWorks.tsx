export default function HowItWorks() {

  const steps = [
    "Upload Financial Data",
    "Review VAT Calculations",
    "Generate VAT Return",
    "Submit & Archive",
  ];

  return (
    <section className="py-24 bg-cyan-50">

      <div className="max-w-6xl mx-auto px-6">

        <div className="text-center mb-16">

          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            4 Simple Steps to VAT Compliance
          </h2>

          <p className="text-xl text-slate-600">
            Streamline your VAT workflow from import to filing.
          </p>

        </div>

        <div className="grid md:grid-cols-4 gap-8">

          {steps.map((step, index) => (

            <div
              key={index}
              className="bg-white rounded-3xl p-8 shadow-lg text-center hover:-translate-y-2 transition duration-300"
            >

              <div className="w-16 h-16 rounded-full bg-cyan-600 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-6">

                {index + 1}

              </div>

              <h3 className="text-xl font-semibold text-slate-900">
                {step}
              </h3>

            </div>
          ))}

        </div>

      </div>
    </section>
  );
}