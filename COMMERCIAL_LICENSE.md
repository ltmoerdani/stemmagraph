# Stemmagraph Licensing

Stemmagraph is released under a **dual-license model** to balance open-source
freedom with sustainable development.

## 📦 TL;DR

| Use case | License | Cost |
|---|---|---|
| Self-host for personal use, study, modify, share | **AGPL-3.0** | **Free** |
| Self-host as SaaS / commercial service | **AGPL-3.0** *(must publish your modifications)* | **Free** |
| Use in a **closed-source** SaaS or commercial product | **Commercial License** | **Paid** |

> **You must publish the source code of any modifications** if you offer
> Stemmagraph as a network service (SaaS). This is the AGPL-3.0 "network copyleft"
> clause (Section 13). If you cannot or do not want to publish your source, you
> need a commercial license.

## 📜 Open Source License (AGPL-3.0)

The default license for Stemmagraph is the [**GNU Affero General Public License
v3.0**](./LICENSE).

- ✅ Use, study, modify, and distribute freely
- ✅ Self-host for yourself, your family, or your community
- ✅ Offer as a SaaS **as long as you publish your modified source code** under AGPL-3.0
- ❌ **Cannot** be used in closed-source commercial products or SaaS without
  publishing the source

See [`LICENSE`](./LICENSE) for the full text.

## 💼 Commercial License

If you want to:

- Use Stemmagraph in a **closed-source commercial product**
- Offer a **SaaS without publishing your source modifications**
- Embed Stemmagraph into **proprietary software**

…then you need a **Commercial License** from the copyright holder.

**Contact:** [ltmoerdani@gmail.com](mailto:ltmoerdani@gmail.com)

Please include:

- Your name / company
- Intended use case (SaaS, embedded, on-prem, etc.)
- Expected number of users / instances
- Any customization you plan to ship

We offer flexible pricing for:

- 🚀 **Startups** — discounted rates, often free for early-stage
- 🏢 **Enterprise** — per-instance or per-user licensing
- 🎓 **Non-profit / education** — generally free

## ❓ Why dual-license?

AGPL-3.0 ensures that **anyone who improves Stemmagraph must share those
improvements with the community** — especially when they deploy it as a network
service. This prevents cloud giants from taking open-source work, wrapping it in
a SaaS, and giving nothing back.

But we understand that not everyone can open-source their entire product. The
commercial license provides that option while funding ongoing development of
Stemmagraph itself.

This model is used by projects like **Mattermost, MinIO, Sentry (self-hosted),
Plausible Analytics, Mastodon, and Element/Matrix**.

## ❓ FAQ

**Can I use Stemmagraph for commercial purposes?**

Yes. AGPL v3 permits commercial use. The one obligation: if you modify the
source code and run it as a hosted service for others, you must publish your
modifications under the same AGPL v3 license. Running it internally for your
own organization or family has no restrictions.

**Can I self-host for free?**

Yes — the entire codebase is AGPL v3 on GitHub. Clone it, run it on your own
server, no license key required. Self-hosting means you manage your own server,
database, and upgrades.

**Can I modify the source and sell the result as my product?**

Only if you publish your modifications under AGPL v3 and make the source code
available to your users. If you cannot or will not publish the source, you need
a commercial license.

**Is my data sent anywhere?**

No. Stemmagraph runs entirely in your browser (mock adapter) or on your own
backend (REST/Supabase adapter). There is no telemetry, no analytics, no
third-party call-home.

**Can I use the "Stemmagraph" name and logo for my fork?**

No. The name "Stemmagraph", the logo, and associated branding are trademarks of
the maintainer. Forks must choose a different name. See the trademark note
below.

## ©️ Trademark

"Stemmagraph" and the Stemmagraph logo are trademarks of ltmoerdani. The AGPL
license grants you rights to the **source code**, but not to the project's name
or branding. If you fork and redistribute, you must choose a different name and
remove the Stemmagraph logo from user-visible surfaces.

## 🤝 Contributor License Agreement (CLA)

By contributing to Stemmagraph, you agree that your contributions will be
licensed under both the AGPL-3.0 and a commercial license held by the project
maintainer. This allows us to offer the commercial license to users who need it.

See [`CLA.md`](./CLA.md) for the full agreement.

This is a standard practice used by virtually all dual-licensed open-source
projects. Without it, we could not offer a commercial license because every
contributor would retain copyright on their code.

## 📄 Summary

This document is a human-readable summary and not legally binding. The
authoritative license text is in [`LICENSE`](./LICENSE) (AGPL-3.0). For commercial
licensing terms, refer to your commercial license agreement.
