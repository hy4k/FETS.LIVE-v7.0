import { useEffect, useState } from "react";
import { ExternalLink, Headphones } from "lucide-react";
import { supabase } from "../lib/supabase";
export const clientSupport = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("prometric"))
    return {
      note: "Test-centre technical support. Choose the system used for your session.",
      links: [
        { label: "Prometric eHelp", url: "https://ehelp.prometric.com/" },
      ],
    };
  if (n.includes("pearson"))
    return {
      note: "Technical support, regional phone contacts and live chat for test-centre staff.",
      links: [
        {
          label: "Technical support",
          url: "https://www.pearsonvue.com/us/en/help.html",
        },
        { label: "Connect portal", url: "https://connect.pearsonvue.com/" },
      ],
    };
  if (n.includes("psi"))
    return {
      note: "Test Center Network help desk, knowledge base and support requests.",
      links: [
        {
          label: "PSI TCN help desk",
          url: "https://helpdesk.psionline.com/hc/en-gb",
        },
      ],
    };
  if (n.includes("paragon") || n.includes("celpip"))
    return {
      note: "Public CELPIP customer support. For live test-centre issues, use the assigned contact in the current centre guide.",
      links: [
        {
          label: "CELPIP contact support",
          url: "https://www.celpip.ca/about-us/contact-us/",
        },
      ],
    };
  if (n.includes("mock"))
    return {
      note: "FETS internal programme. Ask the centre manager for programme support.",
      links: [],
    };
  return {
    note: "A dedicated support link has not been verified. Ask the centre manager for the current client contact.",
    links: [],
  };
};
export default function HelpDesk({
  navigate,
}: {
  navigate: (page: string) => void;
}) {
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]),
    [query, setQuery] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase
      .from("clients")
      .select("id,name")
      .order("name")
      .then(({ data, error }) => {
        if (alive) {
          setError(Boolean(error));
          setClients(error ? [] : data || []);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  const groups = clients
    .filter(
      (c, i, all) =>
        !/celpip/i.test(c.name) || !all.some((x) => /paragon/i.test(x.name)),
    )
    .map((c) => ({
      ...c,
      name: /paragon/i.test(c.name) ? "PARAGON / CELPIP" : c.name,
    }))
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="pd-help">
      <header>
        <div>
          <span className="pd-eyebrow">CLIENT SUPPORT</span>
          <h2>Help desk</h2>
        </div>
        <Headphones size={23} strokeWidth={1.5} />
      </header>
      <p className="pd-help-intro">
        Choose the client, then open the right support channel.
      </p>
      <input
        className="pd-help-search"
        type="search"
        aria-label="Find client support"
        placeholder="Find a client…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error ? (
        <p role="alert">
          The client directory is unavailable. Try refreshing the page.
        </p>
      ) : (
        groups.map((client) => {
          const support = clientSupport(client.name);
          return (
            <article className="pd-help-client" key={client.id}>
              <h3>{client.name}</h3>
              <p>{support.note}</p>
              {support.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                  <ExternalLink size={12} />
                </a>
              ))}
              {!support.links.length && (
                <button className="pd-link" onClick={() => navigate("case")}>
                  Ask the centre manager
                  <ExternalLink size={12} />
                </button>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}
