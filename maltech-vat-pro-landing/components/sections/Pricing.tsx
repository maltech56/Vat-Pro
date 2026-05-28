export default function Pricing() {

  const plans = [
    {
      name: "Starter",
      price: "$29",
      description: "Perfect for small businesses",
      features: [
        "VAT Return Preparation",
        "Excel & CSV Upload",
        "Basic Reporting",
        "Email Support",
      ],
    },

    {
      name: "Professional",
      price: "$79",
      description: "For growing companies",
      features: [
        "Everything in Starter",
        "QuickBooks Integration",
        "Advanced Reports",
        "Multi-User Access",
      ],
      featured: true,
    },

    {
      name: "Enterprise",
      price: "Custom",
      description: "Advanced compliance operations",
      features: [
        "Unlimited Companies",
        "Audit Management",
        "Dedicated Support",
        "Custom Integrations",
      ],
    },
  ];

  return (
    <section
      id="pricing"
      className="py-24 bg-white"
    >

      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">

          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Flexible Pricing for Every Business
          </h2>

          <p className="text-xl text-slate-600">
            Choose the plan that fits your VAT compliance needs.
          </p>

        </div>

        <div className="grid lg:grid-cols-3 gap-8">

          {plans.map((plan, index) => (

            <div
              key={index}
              className={`rounded-3xl p-8 border transition duration-300 hover:shadow-2xl hover:-translate-y-2
              ${
                plan.featured
                  ? "bg-cyan-600 text-white border-cyan-600"
                  : "bg-slate-50"
              }`}
            >

              <h3 className="text-3xl font-bold mb-4">
                {plan.name}
              </h3>

              <div className="text-5xl font-bold mb-4">
                {plan.price}
              </div>

              <p className="mb-8 opacity-90">
                {plan.description}
              </p>

              <div className="space-y-4 mb-10">

                {plan.features.map((feature, i) => (

                  <div
                    key={i}
                    className="flex items-center gap-3"
                  >
                    <div className="w-2 h-2 rounded-full bg-current"></div>

                    <span>{feature}</span>
                  </div>

                ))}

              </div>

              <button
                className={`w-full py-4 rounded-2xl font-semibold transition
                ${
                  plan.featured
                    ? "bg-white text-cyan-700 hover:bg-slate-100"
                    : "bg-cyan-600 text-white hover:bg-cyan-700"
                }`}
              >
                Get Started
              </button>

            </div>
          ))}

        </div>

      </div>
    </section>
  );
}