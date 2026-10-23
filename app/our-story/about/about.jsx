"use client";

import "./about.css";
import Image from "next/image";
import worldMap from "../../../public/maps/countries-50m.json";

import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line
} from "@vnedyalk0v/react19-simple-maps";

import storyCard from "./images/story-making.jpg";
import meaningImage from "./images/meaning.jpg";
import flourCard from "./images/story-cflour.jpg";
import heroImage from "./images/hero-khakra.png";
import founder1Image from "./images/founder1.jpeg";
import founder2Image from "./images/founder2.jpeg";
import blogCover from "./images/blog-cover.jpg";
import nidhishreeImg from "./images/nidhishree.jpg";
import { useState, useEffect, useRef } from "react";

import processFactoryImg from "./images/process-factory.jpg";
import processTeamImg from "./images/process-team.jpg";
import processMillImg from "./images/process-milling.jpg";
import processPackImg from "./images/process-packing.jpg";
import processShapingImg from "./images/process-shaping.jpg";
import processRoastingImg from "./images/process-roasting.jpg";
import processQCImg from "./images/process-qc.jpg";

const tabs = {
  mission: {
    title: "Bridge the growing fibre gap.",
    highlight: "Through mindful nutrition.",
    body:
      "Our mission is to create innovative coconut flour-based foods that are low-carb, high in fibre and protein, gut-healthy, and supportive of better gut health — without compromising on authentic Indian taste and texture.",

    stats: [
      { value: "LOW CARB", sub: "MINDFUL NUTRITION" },
      { value: "HIGH FIBRE", sub: "GUT FRIENDLY" },
      { value: "GUT HEALTHY", sub: "MODERN LIFESTYLES" },
      { value: "PROTEIN RICH", sub: "AUTHENTIC TASTE" },
    ],
  },

  vision: {
    title: "A globally trusted wellness brand.",
    highlight: "Rooted in coconut nutrition.",
    body:
      "To become a globally trusted wellness-focused food brand by addressing the growing fibre gap through innovative coconut-based nutrition tailored for modern lifestyles.",

    quote:
      "Start Your Second Innings — healthier living without compromising on flavour, culture, or experience.",
  },
};

const founders = [
  {
    id: "tejaswini",
    img: founder1Image,
    name: "Smt. G. Tejaswini",
    role: "Managing Director",
    shortBio:
      "Managing Director, Kalpavristi Coco Foods, championing WIN-DIA's mission of heritage-rooted wellness food.",
    fullBio: [
      "Tejaswini is Managing Director at Kalpavristi Coco Foods, the company behind WIN-DIA. She leads the company's operations with a hands-on, disciplined approach, blending strategic thinking with a genuine passion for building something meaningful.",
      "Driven by a vision to make Indian traditional foods globally relevant, she has been instrumental in shaping WIN-DIA's direction — rooted in heritage, built for the future, and known for offerings like the coconut flour Thins.",
    ],
  },
  {
    id: "teni",
    img: founder2Image,
    name: "T N Sridhar",
    role: "Chief Executive Officer",
    shortBio:
      "CEO, Kalpavristi Coco Foods, driving WIN-DIA's growth with strategic, quality-focused leadership.",
    fullBio: [
      "Sridhar serves as Chief Executive Officer at Kalpavristi Coco Foods Pvt. Ltd, the company behind the WIN-DIA brand. He brings a sharp, leadership-driven approach to the business, overseeing strategy and operations as the company builds its presence in the food and wellness space.",
      "His focus is on steering WIN-DIA toward consistent, sustainable growth — combining strong business fundamentals with an unwavering commitment to quality, ensuring every decision aligns with the brand's long-term vision.",
    ],
  },
];

const PROCESS_SLIDES = [
  {
    img: processFactoryImg,
    tag: "Sourcing",
    title: "Sourced by hand",
    body: "Coconuts selected at the source, the same way it's always been done — no shortcuts on quality.",
  },
  {
    img: processMillImg,
    tag: "Milling",
    title: "Milled fresh",
    body: "Dried and milled in small batches to keep the fibre and flavor intact — old wisdom, new equipment.",
  },
  {
    img: processShapingImg,
    tag: "Shaping",
    title: "Shaped, one at a time",
    body: "Each Thin is hand-guided through the press — a small, deliberate step that keeps the texture right.",
  },
  {
    img: processRoastingImg,
    tag: "Roasting",
    title: "Roasted to crisp",
    body: "Slow-roasted on open plates until it's golden and crisp — the same method, done at scale.",
  },
  {
    img: processQCImg,
    tag: "Quality check",
    title: "Checked before it travels",
    body: "Every batch is inspected for colour, crunch and consistency before it's cleared for packing.",
  },
  {
    img: processTeamImg,
    tag: "Our people",
    title: "Shaped by our team",
    body: "Every Thin is shaped and checked by the people who take pride in getting it right, batch after batch.",
  },
  {
    img: processPackImg,
    tag: "Packing",
    title: "Packed with care",
    body: "Sealed fresh and boxed for the journey to you — the last step before it reaches your table.",
  },
];

const PROCESS_SLIDE_DURATION = 6000; // ms

const REGION_COUNTRIES = {
  "middle-east": ["SAU","ARE","IRN","IRQ","JOR","KWT","OMN","QAT","YEM","SYR","LBN","BHR","ISR","PSE"],
  "sea":         ["THA","VNM","IDN","MYS","PHL","SGP","MMR","KHM","LAO","BRN","TLS"],
  "europe":      ["DEU","FRA","GBR","ITA","ESP","NLD","POL","SWE","NOR","DNK","FIN","CHE","AUT","BEL","PRT","GRC","ROU","CZE","HUN","UKR","SVK","SVN","HRV","BGR","SRB","MDA","LTU","LVA","EST","LUX","IRL","CYP","MLT","ALB","MKD","BIH","MNE","AND","MCO","SMR","LIE","ISL"],
  "na":          ["USA","CAN","MEX"],
  "oceania":     ["AUS","NZL"],
};

// Numeric IDs from countries-50m.json (same order)
const REGION_NUMERIC = {
  "middle-east": ["682","784","364","368","400","414","512","634","887","760","422","048","376","275"],
  "sea":         ["764","704","360","458","608","702","104","116","418","096","626"],
  "europe":      ["276","250","826","380","724","528","616","752","578","208","246","756","040","056","620","300","642","203","348","804","703","705","191","100","688","498","440","428","233","442","372","196","470","008","807","070","499","020","492","674","438","352"],
  "na":          ["840","124","484"],
  "oceania":     ["036","554"],
};

//const GEO_URL = "/maps/countries-50m.json";

// These are lon/lat coordinates — react-simple-maps projects them correctly
const REGION_LONLAT = {
  india:         [78,  22],
  "middle-east": [45,  25],
  "sea":         [110,  5],
  "europe":      [15,  52],
  "na":          [-100, 45],
  "oceania":     [135, -25],
};
export default function About() {
    const [activeTabSection, setActiveTabSection] = useState("story");
const [selectedRegion, setSelectedRegion] = useState(null);
      const highlighted = REGION_COUNTRIES[selectedRegion] || [];

        const [activeTab, setActiveTab] = useState("mission");
      
        const current = tabs[activeTab];

const [activeFounder, setActiveFounder] = useState(null);

useEffect(() => {
  const modals = document.querySelectorAll('dialog');
  modals.forEach((m) => {
    const handler = (e) => {
      const rect = m.getBoundingClientRect();
      const outside =
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom;
      if (outside) { document.body.style.overflow = ''; m.close(); }
    };
    m.addEventListener('click', handler);
    return () => m.removeEventListener('click', handler);
  });
}, []);

useEffect(() => {
  const cards = document.querySelectorAll('.about-founder-card');

  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.12 }
  );

  cards.forEach((card, i) => {
    // Staggered entrance — each card 150 ms after the previous
    card.style.transitionDelay = `${i * 0.15}s`;
    observer.observe(card);
  });

  return () => observer.disconnect();
}, []);

return (
    <main className="about-page">
       <section className="about-hero"> 
        {/* Background Image */} 
        <div className="about-hero-bg"> 
          <Image src={heroImage} alt="Coconut Farm" fill priority sizes="100vw" className="about-hero-bg-image" /> 
          </div> 
          {/* Overlay */} 
          <div className="about-hero-overlay"></div> 
          {/* Gradient */} 
          <div className="about-hero-gradient"></div> 
          {/* Bottom Fade */} 
          <div className="about-hero-bottom-fade"></div> 
{/* Content */}
<div className="about-hero-content">

  <p className="about-hero-label">
    ROOTED IN TRADITION
  </p>

  <h1 className="about-hero-title">
    Old Wisdom.
    <br />

    <span className="about-hero-title-italic">
      New Crunch.
    </span>
  </h1>

  <p className="about-hero-description">
    What ancient India understood about the coconut,
    we crafted into every Thin.
  </p>

  <div className="about-hero-scroll">

    <span className="about-hero-scroll-text">
      Discover the Philosophy
    </span>

    <div className="about-hero-scroll-line"></div>

  </div>

</div>
</section>

          <section className="about-tabs">
  <div className="about-tabs-nav">
    {[
  { t: "story",   num: "I",   title: "Our Story",          sub: "How it began" },
  { t: "meaning", num: "II",  title: "Meaning of WIN·DIA", sub: "The name" }
].map(({ t, num, title, sub }) => (
  <button
    key={t}
    data-num={num}
    className={`about-tabs-btn ${activeTabSection === t ? "about-tabs-btn-active" : ""}`}
    onClick={() => setActiveTabSection(t)}
  >
    <span className="about-tabs-btn-num">{num}</span>
    <span className="about-tabs-btn-title">{title}</span>
    <span className="about-tabs-btn-sub">{sub}</span>
  </button>
))}
  </div>

  <div className="about-tabs-panel">

    {/* OUR STORY */}
    {activeTabSection === "story" && (
      <>
        <div key={`img-${activeTabSection}`} className="about-tabs-img-col">
          <Image src={storyCard} alt="Our Story" fill className="about-tabs-img" sizes="50vw" />
          <div className="about-tabs-img-overlay" />
          <div className="about-tabs-img-badge">
            <span className="about-tabs-badge-name">WIN·DIA</span>
            <span className="about-tabs-badge-sub">SINCE 2024</span>
          </div>
        </div>
        <div key={`txt-${activeTabSection}`} className="about-tabs-txt-col">
          <p className="about-tabs-eyebrow">Our Beginning</p>
          <h2 className="about-tabs-head">A truth recovered from our own kitchens.</h2>
          <p className="about-tabs-body">Long before the language of superfoods existed, the coconut was sacred in Indian homes. Communities across coastal India built their diets around it instinctively. Then processed food arrived. Wheat became the default. The coconut was reduced to a garnish on festive sweets.</p>
          <p className="about-tabs-body">India's fiber intake dropped quietly. Today, metabolic disease appears in children shaped entirely by what sits on their plates. Our founder asked, what if we simply brought it back?</p>
          <blockquote className="about-tabs-quote">
            "Coconut flour wasn't a trend we chased. It was a truth we recovered from our own culture, our own kitchens, our own history."
            <span className="about-tabs-quote-attr">— Smt. G. Tejaswini, Founder</span>
          </blockquote>
        </div>
      </>
    )}

    {/* MEANING */}
    {activeTabSection === "meaning" && (
      <>
        <div className="about-tabs-img-col">
  <Image
    src={meaningImage}
    alt="Meaning of WIN-DIA"
    fill
    className="about-tabs-img"
    sizes="50vw"
  />

  <div className="about-tabs-img-overlay" />

  <div className="about-tabs-meaning-overlay">
    <span className="about-tabs-meaning-win">WIN</span>
    <span className="about-tabs-meaning-dot">·</span>
    <span className="about-tabs-meaning-dia">DIA</span>

    <p className="about-tabs-meaning-sub">
      DIAMETER · DIABETES · TO WIN
    </p>
  </div>
</div>
        <div className="about-tabs-txt-col">
          <p className="about-tabs-eyebrow">The Name</p>
          <h2 className="about-tabs-head">Two quiet truths in one word.</h2>
          <p className="about-tabs-body"><em style={{color:"#B85C38"}}>DIA</em> carries two meanings. The first — diabetes, the condition becoming the defining health crisis of our generation. The second — diameter. The full circle. Everywhere, all around.</p>
          <p className="about-tabs-body"><em style={{color:"#6B4C35"}}>WIN</em> is the intention. To beat diabetes, not in one kitchen or one city, but everywhere food is eaten and choices are made.</p>
          <hr className="about-tabs-divider" />
          <div className="about-tabs-pills">
            <span className="about-tabs-pill about-tabs-pill-brown">Defeat diabetes</span>
            <span className="about-tabs-pill about-tabs-pill-gold">Full circle</span>
            <span className="about-tabs-pill about-tabs-pill-sage">Everywhere</span>
            <span className="about-tabs-pill about-tabs-pill-brown">Ancient roots</span>
          </div>
        </div>
      </>
    )}
  </div>
</section>

<section className="about-process-section">
  <div className="about-process-container">
    <div className="about-process-heading">
      <span className="about-process-label">Behind the Brand</span>
      <h2 className="about-process-title">
        The hands. <span className="about-process-title-italic">The heat.</span> The harvest.
      </h2>
    </div>
    <ProcessSlider />
  </div>
</section>

    <section className="about-mission">

  {/* Soft Glow */}
  <div className="about-mission-glow"></div>

  <div className="about-mission-container">

    {/* Label */}
    <p className="about-mission-label">
      WHAT DRIVES US
    </p>

    {/* Toggle */}
    <div className="about-mission-toggle">

      <button
        onClick={() => setActiveTab("mission")}
        className={`about-mission-toggle-button ${
          activeTab === "mission"
            ? "about-mission-toggle-active"
            : ""
        }`}
      >
        MISSION
      </button>

      <button
        onClick={() => setActiveTab("vision")}
        className={`about-mission-toggle-button ${
          activeTab === "vision"
            ? "about-mission-toggle-active"
            : ""
        }`}
      >
        VISION
      </button>

    </div>

    {/* Heading */}
    <h2 className="about-mission-title">

      {current.title}{" "}

      <span className="about-mission-title-italic">
        {current.highlight}
      </span>

    </h2>

    {/* Body */}
    <p className="about-mission-body">
      {current.body}
    </p>

    {/* Luxury Feature Pills */}
    {activeTab === "mission" && (

      <div className="about-mission-features">

        {current.stats.map((item) => (

          <div
            key={item.value}
            className="about-mission-feature"
          >

            <span className="about-mission-feature-line"></span>

            <div>

              <p className="about-mission-feature-title">
                {item.value}
              </p>

              <p className="about-mission-feature-sub">
                {item.sub}
              </p>

            </div>

          </div>

        ))}

      </div>
    )}

    {/* Vision Quote */}
    {activeTab === "vision" && (

      <div className="about-mission-quote-wrapper">

        <p className="about-mission-quote">
          {current.quote}
        </p>

      </div>
    )}

  </div>
</section>

<section  id="founders" className="about-founders">

  <div className="about-founders-container">

    {/* Heading */}
    <div className="about-founders-heading">
      <span className="about-founders-label">The hands behind the crunch</span>
      <h2 className="about-founders-title">Our Founders</h2>
      <span className="about-founders-rule" />
    </div>

    {/* Cards */}
    <div className="about-founders-grid">
      {founders.map((f) => (
        <FounderCard
          key={f.id}
          founder={f}
          onOpen={setActiveFounder}
        />
      ))}
    </div>

  </div>

  {/* Modal */}
  <FounderModal
    founder={activeFounder}
    onClose={() => setActiveFounder(null)}
  />

</section>

<section className="about-blog">
  <div className="about-blog-container">

    <div className="about-blog-heading">
      <span className="about-blog-label">FROM THE JOURNAL</span>
      <h2 className="about-blog-title">Latest Read</h2>
    </div>

    {/* Horizontal Teaser Card */}
    <div
      className="about-blog-teaser-card"
      onClick={() => document.getElementById('blog-modal').showModal()}
    >
      <div className="about-blog-teaser-image-wrapper">
  <Image
    src={blogCover}
    alt="Blog cover"
    fill
    className="about-blog-teaser-img"
  />
  <div className="about-blog-teaser-gradient" />
  <div className="about-blog-teaser-tag">JOURNAL</div>
</div>

      <div className="about-blog-teaser-content">
        <p className="about-blog-teaser-meta">
          By Nidhishree S &nbsp;·&nbsp; Wellness &amp; Nutrition
        </p>
        <h3 className="about-blog-teaser-title">
          Being Healthy is the New Luxury
        </h3>
        <p className="about-blog-teaser-excerpt">
          Technology has evolved so rapidly that its employer — humans — can no longer
          live without its employee. But while life became easier, we forgot the basics.
          Lifestyle diseases are spreading like wildfire — and the answer may be simpler
          than we think.
        </p>
        <div className="about-blog-teaser-cta">
          <span>Read the Full Article</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>

    {/* Full Blog Modal */}
    <dialog id="blog-modal" className="about-blog-modal">
      <div className="about-blog-modal-inner">

        {/* Close Button */}
        <button
          className="about-blog-modal-close"
          onClick={() => document.getElementById('blog-modal').close()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18"/>
          </svg>
        </button>

        {/* Hero Strip */}
        <div className="about-blog-modal-hero">
          <p className="about-blog-modal-label">JOURNAL · WELLNESS &amp; NUTRITION</p>
          <h2 className="about-blog-modal-title">
            Being Healthy is the <span className="about-blog-modal-title-italic">New Luxury</span>
          </h2>
        </div>

        {/* Author Row */}
        <div className="about-blog-modal-author-row">
          <div className="about-blog-modal-avatar">
  <Image src={nidhishreeImg} alt="Nidhishree S" fill style={{objectFit:"cover", borderRadius:"50%"}} />
</div>
          <div>
            <p className="about-blog-modal-author-name">Nidhishree S</p>
            <p className="about-blog-modal-author-meta"> WIN-DIA Journal</p>
          </div>
        </div>

        <div className="about-blog-modal-divider" />

        {/* Body */}
        <div className="about-blog-modal-body">
          <p>Technology has evolved so rapidly that its employer — humans — can no longer live without its employee: technology itself. Very soon, the employer's seat may be taken over by its own creation.</p>

          <p>Today's world is full of options. Whatever you want, you can get instantly, at the drop of a hat. Every problem appears to have an instant solution. It's almost as if you name it, we have it. But here's the irony: while life has become easier, we have forgotten the basics. We don't eat right, we don't move enough, and we don't even breathe mindfully. As a result, lifestyle diseases are spreading like wildfire. Once again, you name it, we have it — but this time, it's problems.</p>

          <p>And this is exactly where the real issue begins to unfold. This endless availability has not just changed our habits; it has quietly reshaped our definition of wealth. Many believe that wealth means the freedom to consume anything and everything — even when it is clearly highly processed, sugar-loaded, oil-heavy, and chemically preserved food, consumed at the expense of health. If this is the mindset, it's time to wake up to reality. Today, it is important to be both wealthy and healthy, because what looks like wealth on the outside should not destroy you from within.</p>

          <blockquote className="about-blog-modal-pullquote">
            What looks like wealth on the outside should not destroy you from within.
          </blockquote>

          <p>It is hard to tell whether it is unfortunate or ironic that many of these issues could be healed if we simply went back to square one. Our traditional food habits, simple eating patterns, and mindful choices were never wrong — we just stopped valuing them. Sometimes, the best solutions are right in front of us, but we fail to recognize them.</p>

          <p>Going back to mindful eating is not about rejecting modern life, but about making smarter and more conscious choices within it. Small shifts — like choosing what you snack on, what ingredients you trust, and how often you reach for convenience — can define your long-term health. The goal is not to restrict yourself, but to choose better.</p>

          <p>Today, smarter snacking is becoming a part of this shift, where people are moving towards high-fibre, clean, and functional foods that align with modern lifestyles.</p>

          <p>This is exactly where <strong>WIN-DIA Products</strong> steps in — a conscious and deliberate choice in a world full of careless consumption. It stands for mindful eating, uncompromised ingredients, and smarter snacking that supports overall well-being. Because at the end of the day, it is not about having access to everything; it is about having the wisdom to choose what truly nourishes you.</p>

          <p className="about-blog-modal-closing">With WIN-DIA, the idea is clear: eat better, live better, and redefine what it truly means to be rich.</p>
        </div>

        <div className="about-blog-modal-divider" />

        {/* Author Footer */}
        <div className="about-blog-modal-author-footer">
<div className="about-blog-modal-avatar about-blog-modal-avatar-lg">
  <Image src={nidhishreeImg} alt="Nidhishree S" fill style={{objectFit:"cover", borderRadius:"50%"}} />
</div>          <div>
            <p className="about-blog-modal-author-name">Nidhishree S</p>
          </div>
        </div>

      </div>
    </dialog>

  </div>
</section>

<section className="about-global">
  <div className="about-global-container">
    <div className="about-global-heading">
      <span className="about-global-label">Planned Global Presence</span>
      <h2 className="about-global-title">Expanding Across the World</h2>
      <p className="about-global-subtitle">
        Thoughtfully bringing coconut wellness to modern lifestyles across key global regions.
      </p>
    </div>

    <WorldMapSVG selected={selectedRegion} onSelect={setSelectedRegion} />

    <div className="about-global-cards">
      {[
        { id: "middle-east", title: "Middle East", desc: "Planned Expansion" },
        { id: "sea", title: "Southeast Asia", desc: "Market Research Phase" },
        { id: "europe", title: "Europe", desc: "Future Consideration" },
        { id: "na", title: "North America", desc: "Long-Term Goal" },
        { id: "oceania", title: "Australia & Oceania", desc: "Future Consideration" },
      ].map((r) => (
        <div
          key={r.id}
          onClick={() => setSelectedRegion(selectedRegion === r.id ? null : r.id)}
          className={`about-global-card ${selectedRegion === r.id ? "about-global-card-active" : ""}`}
        >
          <h3 className="about-global-card-title">{r.title}</h3>
          <p className="about-global-card-desc">{r.desc}</p>
        </div>
      ))}
    </div>
  </div>
</section>

{/* FOOTER — intentionally removed: the global <Footer/> from app/layout.js already
    renders on every page including this one. This local block used to duplicate it. */}
    </main>
  );
}

function openModal(id) {
  document.body.style.overflow = 'hidden';
  document.getElementById(id)?.showModal();
}

function closeModal(id) {
  document.body.style.overflow = '';
  document.getElementById(id)?.close();
}

function WorldMapSVG({ selected, onSelect }) {
  return (
    <div style={{
      background:  "#637d73",
      borderRadius: "20px",
      padding: "1.2rem 1.2rem 0.8rem",
      marginBottom: "2rem",
      overflow: "hidden",
    }}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 160 }}
        width={960}
        height={500}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <Geographies geography={worldMap}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const numId = String(geo.id);
              const isIndia = numId === "356";
              let isHighlighted = false;
              if (selected && REGION_NUMERIC[selected]) {
                isHighlighted = REGION_NUMERIC[selected].includes(numId);
              }
              const isClickable = Object.entries(REGION_NUMERIC).some(([, ids]) => ids.includes(numId));

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={
                    isIndia       ? "#D4A5A5" :
                    isHighlighted ? "#D4A5A5" :
                                    "#F0EAE0"
                  }
                  stroke={isHighlighted || isIndia ? "#d5b0c2" : "#D8D0C4"}
                  strokeWidth={isHighlighted || isIndia ? 0.7 : 0.4}
                  style={{
                    default: { outline: "none", cursor: isClickable ? "pointer" : "default" },
                    hover:   { outline: "none",fill: isHighlighted ? "#C49090" :isIndia ? "#D4A5A5" : "#E8E0D5" },
                    pressed: { outline: "none" },
                  }}
                  onClick={() => {
                    for (const [id, ids] of Object.entries(REGION_NUMERIC)) {
                      if (ids.includes(numId)) {
                        onSelect(selected === id ? null : id);
                        return;
                      }
                    }
                  }}
                />
              );
            })
          }
        </Geographies>

        {/* Curved dashed flight path + animated traveling dot */}
        {selected && (
          <>
            <CurvedArc from={REGION_LONLAT.india} to={REGION_LONLAT[selected]} />
            <AnimatedFlightDot from={REGION_LONLAT.india} to={REGION_LONLAT[selected]} active={Boolean(selected)} />
          </>
        )}

        {/* India pin */}
        <Marker coordinates={REGION_LONLAT.india}>
          <circle r={6} fill="#D4A5A5" stroke="#fff" strokeWidth={1.5} />
          <text y={-12} textAnchor="middle" style={{ fontSize:"8px", fontWeight:700, fill:"#F5EFE6", letterSpacing:"0.12em", fontFamily:"sans-serif" }}>
            INDIA
          </text>
        </Marker>
      </ComposableMap>
    </div>
  );
}

/**
 * Draws a smooth curved flight path between two lon/lat points by
 * interpolating a quadratic Bezier curve (bowed toward the pole, like a
 * real flight path) and rendering it as many short straight segments
 * via react-simple-maps' own <Line>, so it's correctly projected on
 * the actual map (not just a straight line, and not screen-space math
 * that would drift when the map resizes).
 */
function curvedPoints(from, to, segments = 36) {
  const midLon = (from[0] + to[0]) / 2;
  // Bow the curve away from the equator, on whichever side the destination
  // is on — northbound routes arc up toward the pole, southbound routes
  // (e.g. India → Australia) arc down, instead of always bowing north.
  const midLat = to[1] < from[1]
    ? Math.min(from[1], to[1]) - 20
    : Math.max(from[1], to[1]) + 25;
  const control = [midLon, midLat];

  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    points.push([
      mt * mt * from[0] + 2 * mt * t * control[0] + t * t * to[0],
      mt * mt * from[1] + 2 * mt * t * control[1] + t * t * to[1],
    ]);
  }
  return points;
}

function CurvedArc({ from, to }) {
  const points = curvedPoints(from, to);
  return (
    <>
      {points.slice(0, -1).map((p, i) => (
        <Line
          key={i}
          from={p}
          to={points[i + 1]}
          stroke="#D4A5A5"
          strokeWidth={2}
          strokeDasharray="6,5"
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

/** A dot that travels smoothly along the same curved path, looping continuously. */
function AnimatedFlightDot({ from, to, active }) {
  const animRef = useRef(null);
  const tRef = useRef(0);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (!active) { setCoords(null); return; }

    const midLon = (from[0] + to[0]) / 2;
    const midLat = to[1] < from[1]
      ? Math.min(from[1], to[1]) - 20
      : Math.max(from[1], to[1]) + 25;
    const control = [midLon, midLat];

    function step() {
      tRef.current = (tRef.current + 0.0035) % 1;
      const t = tRef.current;
      const mt = 1 - t;
      setCoords([
        mt * mt * from[0] + 2 * mt * t * control[0] + t * t * to[0],
        mt * mt * from[1] + 2 * mt * t * control[1] + t * t * to[1],
      ]);
      animRef.current = requestAnimationFrame(step);
    }
    step();
    return () => cancelAnimationFrame(animRef.current);
  }, [active, from[0], from[1], to[0], to[1]]);

  if (!coords) return null;
  return (
    <Marker coordinates={coords}>
      <circle r={9} fill="#B8849A" opacity={0.25} />
      <circle r={4.5} fill="#B8849A" stroke="#fff" strokeWidth={1} />
    </Marker>
  );
}

function FounderCard({ founder: f, onOpen }) {
  return (
    <button
      className="about-founder-card"
      onClick={() => onOpen(f)}
      aria-label={`Read more about ${f.name}`}
    >
      <div className="about-founder-image-wrapper">
        <Image
          src={f.img}
          alt={f.name}
          fill
          style={{ objectFit: 'cover' }}
          className="about-founder-image"
        />
        <div className="about-founder-image-overlay" />
        <span className="about-founder-image-name">{f.name}</span>
      </div>

      <div className="about-founder-content">
        <p className="about-founder-role">{f.role}</p>
        <h3 className="about-founder-name">{f.name}</h3>
        <p className="about-founder-shortbio">{f.shortBio}</p>
        <span className="about-founder-cta">
          Read their story
          <span className="about-founder-cta-arrow">→</span>
        </span>
      </div>
    </button>
  );
}


function FounderModal({ founder, onClose }) {
  if (!founder) return null;

  return (
    <div
      className="about-founder-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="about-founder-modal-panel">

        <button
          className="about-founder-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="about-founder-modal-grid">

          <div className="about-founder-modal-image-wrapper">
            <Image
              src={founder.img}
              alt={founder.name}
              fill
              style={{ objectFit: 'cover' }}
            />
          </div>

          <div className="about-founder-modal-content">
            <p className="about-founder-modal-role">{founder.role}</p>
            <h2 className="about-founder-modal-name">{founder.name}</h2>
            <div className="about-founder-modal-rule" />
            <div className="about-founder-modal-bio">
              {(founder.fullBio ?? []).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
function ProcessSlider() {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const pausedRef = useRef(false);
  const rafRef = useRef(null);
  const startRef = useRef(Date.now());

  const goTo = (index) => {
    const next = (index + PROCESS_SLIDES.length) % PROCESS_SLIDES.length;
    setCurrent(next);
    startRef.current = Date.now();
    setProgress(0);
  };

  useEffect(() => {
    function tick() {
      if (!pausedRef.current) {
        const elapsed = Date.now() - startRef.current;
        const pct = Math.min(100, (elapsed / PROCESS_SLIDE_DURATION) * 100);
        setProgress(pct);
        if (elapsed >= PROCESS_SLIDE_DURATION) {
          setCurrent((c) => (c + 1) % PROCESS_SLIDES.length);
          startRef.current = Date.now();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const slide = PROCESS_SLIDES[current];

  return (
    <div
      className="about-process-slider"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      <div className="about-process-stage">
        {PROCESS_SLIDES.map((s, i) => (
          <div
            key={s.tag}
            className={`about-process-frame ${i === current ? "about-process-frame-active" : ""}`}
          >
            <Image src={s.img} alt={s.title} fill className="about-process-img" sizes="60vw" />
          </div>
        ))}

        <div className="about-process-nav">
          <button
            type="button"
            aria-label="Previous"
            className="about-process-nav-btn"
            onClick={() => goTo(current - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next"
            className="about-process-nav-btn"
            onClick={() => goTo(current + 1)}
          >
            ›
          </button>
        </div>
      </div>

      <div className="about-process-caption">
        <p className="about-process-count">
          {String(current + 1).padStart(2, "0")} — {String(PROCESS_SLIDES.length).padStart(2, "0")}
        </p>
        <h3 className="about-process-heading-text">{slide.title}</h3>
        <p className="about-process-body">{slide.body}</p>

        <div className="about-process-rule-track">
          <div className="about-process-rule-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="about-process-thumbs">
          {PROCESS_SLIDES.map((s, i) => (
            <button
              key={s.tag}
              type="button"
              aria-label={`Go to slide ${i + 1}: ${s.title}`}
              className={`about-process-thumb ${i === current ? "about-process-thumb-active" : ""}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}