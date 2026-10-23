'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import './Home.css'
import { motion, useReducedMotion } from 'framer-motion'
import Image from 'next/image';
import BannerStrip from "@/src/frontend/components/BannerStrip/BannerStrip";
import WhatsAppButton from "@/src/frontend/components/WhatsAppButton/WhatsAppButton";

import jeeraBg  from './jeera-bg.png'
import garlicBg  from './garlic-bg.png'
import curryBg  from './curry-bg.png'
import onionBg   from './onion-bg.png'
import all4 from './all-4.jpg'

// ── Why Us — wood background
import woodBg from './bg-image-wood.png'

// ── Why Us — 6 panel backgrounds
import bgLowGi          from './low-gi.jpg'
import bgHighFibre      from './high-fibre.png'
import bgCholesterol    from './0-cholestrol.jpg'
import bgNoMaida        from './no-maida.jpg'
import bgNoPreservatives from './no-preservatives.png'
import bgNoPalmOil      from './No-palmoil.png'
import whyusBg      from './whyus-bg.png'

// ── Range Categories — peek images
import jeeraImg from './jeera (2).png'
import methiImg from './methi (2).png'

// ── Featured Products — background
import featProductBg from './feat-product-bg.jpg'

// ── Featured Products — 4 frames per product (base / tilt / opening / open)
import onionBase from './onion-base.png'
import onionTilt from './onion-tilt.png'
import onionOpening from './onion-opening.png'
import onionOpen from './onion-open.png'

import jeeraBase    from './jeera (2).png'
import jeeraTilt    from './jeera tilt.png'
import jeeraOpening from './jeera opening.png'
import jeeraOpen    from './jeera open.png'

import curryBase    from './curry leaves (2).png'
import curryTilt    from './curry leaf tilt.png'
import curryOpening from './curry leaf opening.png'
import curryOpen    from './curry leaf open.png'

import garlicBase    from './garlic (2).png'
import garlicTilt    from './garlic tilt.png'
import garlicOpening from './garlic opening.png'
import garlicOpen    from './garlic open.png'

import recognition1 from './recognition-1.jpeg';
import recognition2 from './recognition-2.jpeg';
import recognition3 from './recognition-3.jpeg';
import recognition4 from './recognition-4.jpeg';
import recognition5 from './recognition-5.jpeg';
import recognition6 from './recognition-6.jpeg';

import heroBg2 from './Hero-bg2.png';
import productHero1 from './product-hero-1.png';
import crispCloseup from './crisp-closeup.png';
import servingPlate from './serving-plate.png';
import familySnack from './family-snack.png';
import ig4 from './ig4.png';

import founderTejaswini from './founder-tejaswini.jpeg';
import founderSridhar from './founder-sridhar.jpeg';


import story1 from './story1.jpeg'
import story5 from './story5.jpeg'
import videoBg from './video-bg.png'


function SafeImage({ src, alt, ...props }) {
  return <Image src={src} alt={alt} {...props} />;
}


/* ============================================================
   HERO
   ============================================================ */
const SLIDES = [
  {
    id: 'video',
    type: 'video',
    bg: '#1a0f05',
    accent: '#f5c4a0',
    announceBg: '#1a0f05',
    announceText: '#f5e0c8',
    announceMsg: 'Free delivery on orders above ₹299 · 100% Natural · FSSAI Certified',
    heroBg: '#1a0f05',
  },
  { type: 'flavour', flavour: 'Jeera',    background: jeeraBg.src,   bg: '#6F4A2D', accent: '#f5deb3', textColor: '#fff8f0', tagline: 'Earthy & Warm',     headline: 'Jeera\nFlavour',   sub: 'The classic Indian spice — bold, aromatic and guilt-free.',       badge: 'High Fibre · 0% Maida · Low GI', imgPlaceholderColor: '#d4873a' },
  { type: 'flavour', flavour: 'Garlic',    background: garlicBg.src,  bg: '#E1ACAC', accent: '#f4c89a', textColor: '#fff5f0', tagline: 'Bold & Punchy',      headline: 'Garlic\nFlavour',  sub: 'Intense roasted garlic in every crisp, wholesome bite.',         badge: 'High Fibre · 0% Maida · Low GI', imgPlaceholderColor: '#a03535' },
  { type: 'flavour', flavour: 'Onion',    background: onionBg.src,   bg: '#A888B5', accent: '#f0c4f0', textColor: '#fff0ff', tagline: 'Sweet & Savoury',    headline: 'Onion\nFlavour',   sub: 'Caramelised onion warmth baked into every thin crisp.',          badge: 'High Fibre · 0% Maida · Low GI', imgPlaceholderColor: '#8c4f8c' },
  { type: 'flavour', flavour: 'Curry',    background: curryBg.src,   bg: '#468432', accent: '#d4e89a', textColor: '#f5fff0', tagline: 'Distinctly Desi',    headline: 'Curry\nFlavour',   sub: 'Aromatic curry flavour in every crunchy bite.',                  badge: 'High Fibre · 0% Maida · Low GI', imgPlaceholderColor: '#637d25' },
  { type: 'flavour', flavour: 'All Flavours', background: all4.src,  bg: '#637d25', accent: '#d4e89a', textColor: '#f5fff0', tagline: 'The Complete Collection', headline: 'All\nFlavours', sub: 'Discover every delicious WIN-DIA Thins flavour.', badge: 'High Fibre · 0% Maida · Low GI', imgPlaceholderColor: '#637d25' }
]

const DURATION = 5000

function HeroSection() {
  const getContent = (_, fallback) => fallback;
  const [current, setCurrent] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef(null)
  const progressRef = useRef(null)
  const videoRef = useRef(null)

  const goTo = (index) => {
  setCurrent(index)
  setProgress(0)
  pausedProgressRef.current = 0  
  setIsPaused(false)             
  setAnimKey(k => k + 1)
}
  const goNext = () => goTo((current + 1) % SLIDES.length)
const goPrev = () => goTo((current - 1 + SLIDES.length) % SLIDES.length)
const handleVideoEnd = () => goNext()
const handleSlideClick = () => {
  setIsPaused(prev => {
    const newPaused = !prev
    if (slide.type === 'video' && videoRef.current) {
      newPaused ? videoRef.current.pause() : videoRef.current.play()
    }
    return newPaused
  })
}
const slide = SLIDES[current]
  
const pausedProgressRef = useRef(0)

useEffect(() => {
  clearInterval(intervalRef.current)
  if (slide.type !== 'video' && !isPaused) {
    const remaining = ((100 - pausedProgressRef.current) / 100) * DURATION
    intervalRef.current = setTimeout(() => {
      pausedProgressRef.current = 0
      goNext()
    }, remaining)
  }
  return () => clearTimeout(intervalRef.current)
}, [current, isPaused])
useEffect(() => {
  clearInterval(progressRef.current)
  if (isPaused) {
    pausedProgressRef.current = progress  
    return
  }

  const remaining = ((100 - pausedProgressRef.current) / 100) * DURATION 
  const start = Date.now()

  progressRef.current = setInterval(() => {
    const elapsed = Date.now() - start
    const newProgress = pausedProgressRef.current + (elapsed / DURATION) * 100
    setProgress(Math.min(newProgress, 100))
  }, 30)

  return () => clearInterval(progressRef.current)
}, [current, isPaused])

  return (
    <section className="hero" style={{ '--hero-bg': slide.bg, '--hero-accent': slide.accent }}>
      {/* Progress bar */} 
      <div className="hero-progress">
        <div className="hero-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="hero-bg-layer" key={`bg-${current}`} />
      <div className="hero-grain" />

      <div className="hero-inner" key={animKey} onClick={handleSlideClick}>
        {isPaused && (
  <div className="hero-pause-badge">
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <rect x="6" y="4" width="4" height="16" rx="1"/>
      <rect x="14" y="4" width="4" height="16" rx="1"/>
    </svg>
    Paused
  </div>
)}
        {slide.type === 'video' ? (
  /* ── VIDEO SLIDE — full background ── */
  <div className="hero-video-slide"><video
  className="hero-video-bg"
  autoPlay
  muted
  loop = {false}
  playsInline
  ref={videoRef} 
  onEnded={handleVideoEnd}
>
  <source src="/video/hero_vdo.mp4" type="video/mp4" />
</video>

    {/* Dark overlay so text is readable */}
    <div className="hero-video-overlay" />

    {/* Centered content over video */}
    <div className="hero-video-content">
      <p className="hero-eyebrow">{getContent('hero.eyebrow', 'WIN-DIA · FIBRERICH')}</p>
      <h1 className="hero-title video-title">
        Coconut<br /><em>Infused</em> Thins
      </h1>
      <div className="hero-stats">
        <div className="stat">
          <span className="stat-num">0 mg</span>
          <span className="stat-label">Cholestrol</span>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <span className="stat-num">48</span>
          <span className="stat-label">Glycaemic Index</span>
        </div>
        <div className="stat-divider" />
        <div className="stat">
          <span className="stat-num">22</span>
          <span className="stat-label">Protein</span>
        </div>
      </div>
      <Link href="/shop" className="hero-cta" onClick={(e) => e.stopPropagation()}>Shop Now</Link>
    </div>


  </div>
) : (
  /* ── FLAVOUR SLIDE ── */
<div
  className="hero-flavour-slide"
  style={{
    backgroundImage: `linear-gradient(
      rgba(0,0,0,0.28),
      rgba(0,0,0,0.28)
    ), url(${slide.background})`,
    backgroundSize: "cover",
    backgroundPosition: "center ",
    backgroundRepeat: "no-repeat",
  }}
>
  <div className="hero-content" style={{ color: slide.textColor }}>
    <p className="hero-eyebrow" style={{ color: slide.accent }}>
      {slide.tagline}
    </p>

    <h1 className="hero-title flavour-title">
      {slide.headline.split("\n").map((line, i) => (
        <span key={i} className={i === 0 ? "title-small" : "title-big"}>
          {line}
          <br />
        </span>
      ))}
    </h1>

    {slide.comingSoon ? (
  <div className="hero-coming-soon">
    COMING SOON
  </div>
) : (
  <>
    <div className="hero-badge-pill">
      {slide.badge}
    </div>

    <div className="hero-actions">
      <Link href="/shop" className="hero-cta">
        Shop Now
      </Link>
    </div>
  </>
)}
  </div>
</div>
)} 

    
      {/* Navigation Arrows */}
<div className="hero-nav-arrows">
  <button
    className="hero-arrow-btn hero-arrow-prev"
    onClick={(e) => { e.stopPropagation(); goPrev() }}
    aria-label="Previous slide"
  >
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <polyline points="15,18 9,12 15,6" strokeWidth="2" stroke="currentColor" fill="none"/>
    </svg>
  </button>

  <button
    className="hero-arrow-btn hero-arrow-next"
    onClick={(e) => { e.stopPropagation(); goNext() }}
    aria-label="Next slide"
  >
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <polyline points="9,18 15,12 9,6" strokeWidth="2" stroke="currentColor" fill="none"/>
    </svg>
  </button>
</div>

      {/* Dots */}
      {slide.type !== 'video' && (
      <div className="hero-dots">
        {SLIDES.map((s, i) => (
          <button
            key={i}
            className={`hero-dot${i === current ? ' active' : ''}`}
            onClick={(e) => { e.stopPropagation(); goTo(i) }}
            aria-label={s.type === 'video' ? 'Video slide' : s.flavour}
            style={i === current ? { background: slide.accent } : {}}
          />
        ))}
      </div>
      )}
      </div> 
    </section>
  )
}




/* ============================================================
   SECTION 1 — WHY US BANNER
   Left: intro copy. Right: horizontally scrollable photo strip.
   ============================================================ */

const WHY_PANELS = [
  {
    label: 'Low GI',
    desc: 'No sugar spikes, steady energy.',
    bg: bgLowGi.src,
  },
  {
    label: 'High Fibre',
    desc: 'Keeps you fuller, longer.',
    bg: bgHighFibre.src,
  },
  {
    label: '0% Cholesterol',
    desc: 'Heart-friendly, always.',
    bg: bgCholesterol.src,
  },
  {
    label: 'No Maida',
    desc: 'Real grains, not refined flour.',
    bg: bgNoMaida.src,
  },
  {
    label: 'No Preservatives',
    desc: 'Nothing hidden or artificial.',
    bg: bgNoPreservatives.src,
  },
  {
    label: 'No Palm Oil',
    desc: 'Simple, cleaner crunch.',
    bg: bgNoPalmOil.src,
  },
]

function WhyUsBanner() {
  const sectionRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="why-us-banner" ref={sectionRef}>
      <div className="why-us-inner">
        {/* Left: intro copy */}
        <div className="why-us-left">
          <div className="why-us-eyebrow">
            <span className="why-us-dash" />
            Why Choose Us
          </div>
          <h2 className="why-us-title">
            Honest snacking,
            <br />
            done right.
          </h2>
          <p className="why-us-sub">
            Six things we never compromise on, so every bite is one you
            can actually feel good about.
          </p>
        </div>

        {/* Right: horizontally scrollable photo strip */}
        <div className="why-us-scroll" role="list">
          {WHY_PANELS.map((p, i) => (
            <motion.div
              key={p.label}
              className="why-us-card"
              role="listitem"
              tabIndex={0}
              style={{ backgroundImage: `url(${p.bg})` }}
              initial={{ opacity: 0, y: 16 }}
              animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
            >
              <div className="why-us-scrim" />
              <span className="why-us-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="why-us-body">
                <div className="why-us-h">{p.label}</div>
                <p className="why-us-d">{p.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}



/* ============================================================
   SECTION 2 — RANGE CATEGORIES
   ============================================================ */

function RangeCategories() {
  return (
    <section className="products" id="shop">
      <div className="products-split">

        {/* LEFT — Everyday Classics Range */}
        <div className="products-split-left">
          <img
            src={jeeraImg.src}
            alt="Jeera"
            className="products-peek products-peek-left"
          />
          <div className="products-split-content products-split-content--left">
            <div className="products-split-top">
              <div className="products-split-eyebrow">Crafted from Tradition</div>
              <h2 className="products-split-title">
                <em>Gut-Friendly</em><br />Range
              </h2>
            </div>
            <div className="products-split-bottom">
              <p className="products-split-desc">
                Wholesome ingredients, aromatic jeera, and a satisfying crunch crafted for everyday gut-friendly enjoyment.
              </p>
              <a href="/shop?range=regular" className="products-range-btn">
                Explore Gut-Friendly Range <span className="btn-arrow">→</span>
              </a>
            </div>
          </div>
        </div>

        {/* RIGHT — Gut-Healthy Range */}
        <div className="products-split-right">
          <img
            src={methiImg.src}
            alt="Methi"
            className="products-peek products-peek-right"
          />
          <div className="products-split-content products-split-content--right">
            <div className="products-split-top">
              <div className="products-split-eyebrow">Made for Mindful Snacking</div>
              <h2 className="products-split-title">
                <em>Everyday Classics</em><br />Range
              </h2>
            </div>
            <div className="products-split-bottom">
              <p className="products-split-desc">
                Wholesome ingredients, authentic flavors, and satisfying crunch for daily enjoyment.
              </p>
              <a href="/shop?range=gut-healthy" className="products-range-btn">
                Explore Everyday Classics Range <span className="btn-arrow">→</span>
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}



/* ============================================================
   SECTION 3 — FEATURED PRODUCTS
   ============================================================ */

const FEATURED_PRODUCTS = [
 {
    base: onionBase.src,
    tilt: onionTilt.src,
    opening: onionOpening.src,
    open: onionOpen.src,
    name: 'Onion Thins',
    price: '₹___',
  },
  {
    base: jeeraBase.src,
    tilt: jeeraTilt.src,
    opening: jeeraOpening.src,
    open: jeeraOpen.src,
    name: 'Jeera Thins',
    price: '₹180',
  },
  {
    base: curryBase.src,
    tilt: curryTilt.src,
    opening: curryOpening.src,
    open: curryOpen.src,
    name: 'Curry Leaf Thins',
    price: '₹180',
  },
  {
    base: garlicBase.src,
    tilt: garlicTilt.src,
    opening: garlicOpening.src,
    open: garlicOpen.src,
    name: 'Garlic Thins',
    price: '₹200',
  },
]

function FeaturedProducts() {
  const [activeProduct, setActiveProduct] = useState(null)
  const [productFrame, setProductFrame] = useState({}) // { [idx]: 'base'|'tilt'|'opening'|'open' }
  const productTimers = useRef({})

  useEffect(() => {
    FEATURED_PRODUCTS.forEach(p => {
      [p.base, p.tilt, p.opening, p.open].forEach(src => {
        const img = new window.Image()
        img.src = src
      })
    })
  }, [])

  const activateProduct = (i) => {
    clearTimeout(productTimers.current[i])
    setProductFrame(f => ({ ...f, [i]: 'tilt' }))
    productTimers.current[i] = setTimeout(() => {
      setProductFrame(f => ({ ...f, [i]: 'opening' }))
      productTimers.current[i] = setTimeout(() => {
        setProductFrame(f => ({ ...f, [i]: 'open' }))
      }, 600)
    }, 600)
  }

  const deactivateProduct = (i) => {
    clearTimeout(productTimers.current[i])
    setProductFrame(f => ({ ...f, [i]: 'base' }))
    setActiveProduct(null)
  }

  return (
    <section
      className="recipes-banner"
      id="recipes"
      style={{
        backgroundImage: `url(${featProductBg.src})`,
        backgroundRepeat: 'repeat',
        backgroundSize: 'cover',
      }}
      onClick={() => {
        Object.keys(productTimers.current).forEach(k => clearTimeout(productTimers.current[k]))
        setProductFrame({})
        setActiveProduct(null)
      }}
    >
      {/* Title */}
      <div className="featured-eyebrow">OUR FEATURED PRODUCTS</div>

      {/* Product grid */}
      <div className="featured-grid">
        {FEATURED_PRODUCTS.map((p, i) => {
          const frame = productFrame[i] || 'base'
          const src = p[frame]
          return (
            <div
              key={i}
              className="featured-item"
              onMouseEnter={() => { setActiveProduct(i); activateProduct(i) }}
              onMouseLeave={() => deactivateProduct(i)}
              onClick={(e) => {
                e.stopPropagation()
                if (activeProduct === i) deactivateProduct(i)
                else { setActiveProduct(i); activateProduct(i) }
              }}
            >
              <div className="featured-img-wrap">
                <img src={src} alt={p.name} className="featured-frame" />
              </div>
              <div className="featured-info">
                <div className="featured-name">{p.name}</div>
                
                <Link
                  href="/shop"
                  className="featured-add"
                  onClick={e => e.stopPropagation()}
                >
                  Explore
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Explore CTA */}
      <div className="featured-explore-wrap">
        <div className="featured-explore-rule">
          <span className="featured-explore-line" />
          <span className="featured-explore-glitter">✦ ✦ ✦</span>
          <span className="featured-explore-line" />
        </div>
        <Link href="/shop" className="featured-explore-cta">
          <span className="featured-explore-label">Explore Our Full Collection</span>
          <span className="featured-explore-arrow">→</span>
        </Link>
      </div>
    </section>
  )
}

/* ============================================================
   TESTIMONIALS
   ============================================================ */
/*const videoReviews = [
  { id: 1, src: '/video/review1.mp4',  name: 'Ananya', location: 'Bengaluru', lift: true },
  { id: 2, src: '/video/review2.mp4',  name: 'Karthik', location: 'Hyderabad', lift: false },
  { id: 3, src: '/video/review3.mp4',  name: 'Sneha', location: 'Pune', lift: true },
]*/

const reviews = [
  { rating: 5.0, quote: "I bought these for healthier snacking, but they've become a small ritual in our home. Every evening tea now feels incomplete without them. The jeera flavour especially has this warmth that just feels like home.", author: "Priya Mehta", location: "Bengaluru", product: "Garlic Thins" },

  { rating: 4.7, quote: "Finding something wholesome that my whole family enjoys is rare. These crisps somehow bring together flavour, tradition, and comfort in every bite. My kids ask for them after school and my parents love them with chai.", author: "Anjali Rao", location: "Mysuru", product: "Jeera Thins" },

  { rating: 4.5, quote: "The first bite reminded me of homemade snacks we grew up with. It feels comforting to find something traditional that fits today's lifestyle. I've tried nearly every flavour now and honestly can't pick a favourite.", author: "Rohit", location: "Bangalore", product: "Onion Thins" },

  { rating: 4.8, quote: "What started as curiosity turned into a pantry essential. They've become my go-to for busy days, quiet evenings, and everything in between. I love that I don't feel guilty reaching for a second handful.", author: "Meera Krishnan", location: "Chennai", product: "Curry Thins" },

  { rating: 4.3, quote: "Some snacks satisfy cravings. These feel different — wholesome, familiar, and made with care you can actually taste. I ordered once thinking I'd try it out, and within a week I was placing my second order.", author: "Nisha Patel", location: "Hyderabad", product: "Jeera Thins" },
]

/* ---------- Video card ---------- */
/*function VideoReviewCard({ review }) {
  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)

  const handleEnter = () => {
    if (window.matchMedia('(hover: none)').matches) return
    videoRef.current?.play()
    setPlaying(true)
  }
  const handleLeave = () => {
    if (window.matchMedia('(hover: none)').matches) return
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
    setPlaying(false)
  }
  const handleTap = () => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
      setPlaying(true)
    } else {
      videoRef.current.pause()
      setPlaying(false)
    }
  }

  return (
    <div className={`tv-card-wrap${review.lift ? ' tv-card-wrap--lift' : ''}`}>
      <div
        className="tv-card"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleTap}
      >
        <video
          ref={videoRef}
          src={review.src}
          poster={review.poster}
          className="tv-card__video"
          loop
          playsInline
          controls
        />
        {!playing && (
          <div className="tv-card__play" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,3 21,12 6,21" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}*/

/* ---------- Star rating ---------- */
function StarRating({ rating }) {
  const full = Math.floor(rating)
  const partial = Math.round((rating - full) * 10) / 10
  const empty = 5 - full - (partial > 0 ? 1 : 0)
  const id = `partial-${Math.round(rating * 10)}`

  return (
    <div className="qs-stars">
      {[...Array(full)].map((_, i) => (
        <svg key={`f${i}`} width="15" height="15" viewBox="0 0 24 24" fill="#C9A45B">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
      {partial > 0 && (
        <svg key="p" width="15" height="15" viewBox="0 0 24 24">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <stop offset={`${partial * 100}%`} stopColor="#C9A45B"/>
              <stop offset={`${partial * 100}%`} stopColor="#D8C3A5"/>
            </linearGradient>
          </defs>
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill={`url(#${id})`}/>
        </svg>
      )}
      {[...Array(empty)].map((_, i) => (
        <svg key={`e${i}`} width="15" height="15" viewBox="0 0 24 24" fill="#D8C3A5">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
    </div>
  )
}

/* ---------- Written review slider ---------- */
function QuoteSlider() {
  const [current, setCurrent] = useState(0)
  const [fade, setFade] = useState(true)
  const autoRef = useRef(null)
  const startXRef = useRef(null)

  const goTo = (index) => {
    setFade(false)
    setTimeout(() => {
      setCurrent(index)
      setFade(true)
    }, 220)
  }

  const next = () => goTo((current + 1) % reviews.length)
  const prev = () => goTo((current - 1 + reviews.length) % reviews.length)

  const startAuto = () => {
    clearInterval(autoRef.current)
    autoRef.current = setInterval(() => {
      setCurrent(c => {
        const n = (c + 1) % reviews.length
        setFade(false)
        setTimeout(() => setFade(true), 220)
        return n
      })
    }, 4500)
  }
  const stopAuto = () => clearInterval(autoRef.current)

  useEffect(() => {
    startAuto()
    return () => clearInterval(autoRef.current)
  }, [])

  const review = reviews[current]

  return (
    <div
      className="qs-wrap"
      onMouseEnter={stopAuto}
      onMouseLeave={startAuto}
      onTouchStart={e => {
        stopAuto()
        startXRef.current = e.touches[0].clientX
      }}
      onTouchEnd={e => {
        const dx = e.changedTouches[0].clientX - startXRef.current
        if (dx < -40) next(); else if (dx > 40) prev()
        startAuto()
      }}
    >
      <div className="qs-stage" style={{ opacity: fade ? 1 : 0 }}>
        <StarRating rating={review.rating} />
        <p className="qs-quote">&ldquo;{review.quote}&rdquo;</p>
        <p className="qs-author">{review.author}</p>
        <p className="qs-meta">{review.location} &middot; {review.product}</p>
      </div>

      <div className="qs-controls">
        <button className="qs-arrow" onClick={prev} aria-label="Previous review">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="qs-dots">
          {reviews.map((_, i) => (
            <button
              key={i}
              className={`qs-dot${i === current ? ' qs-dot--active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Go to review ${i + 1}`}
            />
          ))}
        </div>
        <button className="qs-arrow" onClick={next} aria-label="Next review">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  )
}

function Testimonials() {
  return (
    <section className="tc-section">
      <span className="tc-label">Testimonials</span>
      <h2 className="tc-heading">Loved by thousands</h2>
      <p className="tc-sub">Real people · Real results</p>
    
      {/* ---------- Section 1: video reviews ---------- 
      <div className="tv-row">
        {videoReviews.map(review => (
          <VideoReviewCard key={review.id} review={review} />
        ))}
      </div>
      
      <div className="tc-divider" />
      */}
    

      {/* ---------- Section 2: written reviews ---------- */}
      <QuoteSlider />
    </section>
  )
}



/* ============================================================
   RECOGNITION
   ============================================================ */

  const recognitions = [
  { title: 'Karnataka Startup Recognized', subtitle: 'Startup Karnataka Initiative', description: 'Kalpavristi Coco Foods Pvt. Ltd. is officially recognized under the Karnataka Government\'s Startup initiative. This recognition by the Karnataka Startup Cell provides access to fiscal incentives, funding support, mentorship, and market development resources — validating Win-Dia as an innovative food-tech venture from Karnataka.', image: recognition1.src, bgImage: heroBg2.src , blogUrl: 'https://www.linkedin.com/in/g-tejaswini-281a7b340/', organization: 'Startup Karnataka — Govt. of Karnataka' },
  { title: 'CFTRI Recognized', subtitle: 'Food Innovation & Excellence', description: 'Kalpavristi Coco Foods Pvt. Ltd. has been recognized by the Central Food Technological Research Institute (CFTRI), one of India’s leading food research institutions. This recognition reflects our commitment to innovation, quality, and the development of better, value-driven food products.', image: recognition2.src, bgImage: heroBg2.src, blogUrl: 'https://www.linkedin.com/in/g-tejaswini-281a7b340/', organization: 'Central Food Technological Research Institute (CFTRI)' },
  { title: 'RISE Conclave 2026', subtitle: 'Research, Industry & Startup Recognition', description: 'Kalpavristi Coco Foods Pvt. Ltd. participated in RISE Conclave 2026, the Research, Industry, Startup and Entrepreneurship Conclave organized in Bengaluru. The event brought together research, industry, startups, and entrepreneurship, providing an opportunity to showcase our food innovation journey and connect with India’s broader innovation ecosystem.', image: recognition3.src, bgImage: heroBg2.src, blogUrl: 'https://www.linkedin.com/in/g-tejaswini-281a7b340/', organization: 'CSIR — RISE Conclave 2026' },
  { title: 'APEDA BHARATI Programme', subtitle: 'Export Enablement & Global Market Readiness', description: 'Kalpavristi Coco Foods Pvt. Ltd. successfully participated in Cohort 1 of APEDA’s BHARATI Export Enablement Acceleration Programme, gaining valuable insights into export opportunities and global market readiness.', image: recognition4.src, bgImage: heroBg2.src, blogUrl: 'https://www.linkedin.com/in/g-tejaswini-281a7b340/', organization: 'APEDA — BHARATI Export Enablement Acceleration Programme' },
  { title: 'APEDA BHARATI Programme', subtitle: 'Export Enablement & Global Market Readiness', description: 'As part of the APEDA BHARATI programme, Kalpavristi Coco Foods Pvt. Ltd. engaged with experts, industry leaders, and fellow innovators to understand the evolving agri-food export ecosystem and opportunities for Indian food brands.', image: recognition5.src, bgImage: heroBg2.src, blogUrl: 'https://www.linkedin.com/in/g-tejaswini-281a7b340/', organization: 'APEDA — BHARATI Export Enablement Acceleration Programme' },
  { title: 'APEDA BHARATI Programme', subtitle: 'Export Enablement & Global Market Readiness', description: 'Successfully completing the programme marked an important step in our journey towards taking innovative Indian food products to international markets. The experience strengthened our focus on export readiness and our vision of bringing products from Bharat to the world.', image: recognition6.src, bgImage: heroBg2.src, blogUrl: 'https://www.linkedin.com/in/g-tejaswini-281a7b340/', organization: 'APEDA — BHARATI Export Enablement Acceleration Programme' },
];


  function RecognitionSection (){

  const [isMounted, setIsMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);

  useEffect(() => { setIsMounted(true); }, []);

  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isMounted) return;
    const animate = () => {
      if (!scrollContainerRef.current || isScrollingRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      const diff = targetScrollRef.current - currentScrollRef.current;
      currentScrollRef.current += diff * 0.07;
      scrollContainerRef.current.scrollLeft = currentScrollRef.current;
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isMounted]);

  // Detect which card is most centered during scroll → update content + pause RAF
  useEffect(() => {
    if (!isMounted) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const onScroll = () => {
  if (!container) return;

  isScrollingRef.current = true;
  currentScrollRef.current = container.scrollLeft;
  targetScrollRef.current = container.scrollLeft;

  clearTimeout(scrollTimeoutRef.current);

  scrollTimeoutRef.current = setTimeout(() => {
    isScrollingRef.current = false;
  }, 150);

  const cards = container.querySelectorAll('.rec-card-btn');

  if (!cards.length) return;

  const containerRect = container.getBoundingClientRect();
  const containerCenter =
    containerRect.left + containerRect.width / 2;

  let closestIndex = 0;
  let closestDistance = Infinity;

  cards.forEach((card, index) => {
    const cardRect = card.getBoundingClientRect();

    const cardCenter =
      cardRect.left + cardRect.width / 2;

    const distance = Math.abs(cardCenter - containerCenter);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  setActiveIndex(closestIndex);
};

     

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [isMounted]);

  // Scroll cards to center the active card
  const scrollToCard = (index) => {
  if (!scrollContainerRef.current) return;

  const container = scrollContainerRef.current;
  const cards = container.querySelectorAll('.rec-card-btn');

  if (!cards[index]) return;

  const card = cards[index];

  const containerRect = container.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();

  const currentScroll = container.scrollLeft;

  const cardCenter =
    cardRect.left - containerRect.left + currentScroll + cardRect.width / 2;

  const target =
    cardCenter - containerRect.width / 2;

  targetScrollRef.current = Math.max(
    0,
    Math.min(
      target,
      container.scrollWidth - container.clientWidth
    )
  );
};

  // When dot clicked — update content AND scroll cards
  const handleDotClick = (index) => {
    setActiveIndex(index);
    scrollToCard(index);
  };

  // When card hovered — update content AND dots
  const handleCardHover = (index) => {
    setActiveIndex(index);
  };

  const handleMouseMove = (e) => {
  if (!scrollContainerRef.current) return;

  const container = scrollContainerRef.current;
  const rect = container.getBoundingClientRect();

  const pct = Math.max(
    0,
    Math.min(1, (e.clientX - rect.left) / rect.width)
  );

  targetScrollRef.current =
    pct * (container.scrollWidth - container.clientWidth);
};

  if (!isMounted) {
    return <section className="rec-section" style={{minHeight:'70vh',background:'linear-gradient(135deg,#FBF3EA,#FBF3EA)'}}></section>;
  }

  const active = recognitions[activeIndex];

  return (
    <section className="rec-section">
      <div className="rec-bg-layer">
        {recognitions.map((item, index) => (
          <motion.div key={index} className="rec-bg-item" initial={{opacity:0}} animate={{opacity:activeIndex===index?1:0}} transition={{duration:0.5,ease:'easeInOut'}}>
            <img src={item.bgImage} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} />
            <div className="rec-bg-overlay1" />
            <div className="rec-bg-overlay2" />
          </motion.div>
        ))}
      </div>

      <div className="rec-main">
        {/* Desktop nav dots */}
        <div className="rec-nav-desktop">
          {recognitions.map((_, index) => (
            <button key={index} onClick={() => handleDotClick(index)} className="rec-nav-btn">
              <motion.div className={`rec-nav-dot${activeIndex===index?' active':''}`} whileHover={{scale:1.5}} />
              {index < recognitions.length - 1 && <div className="rec-nav-line" />}
            </button>
          ))}
        </div>

        {/* Mobile nav dots */}
        <div className="rec-nav-mobile">
          {recognitions.map((_, index) => (
            <button key={index} onClick={() => handleDotClick(index)} className="rec-nav-btn">
              <motion.div className={`rec-nav-dot-mobile${activeIndex===index?' active':''}`} whileTap={{scale:1.6}} />
            </button>
          ))}
        </div>

        <div className="rec-content-area">
          {/* Left: text */}
          <div className="rec-left">
            <div className="rec-left-inner">
              <div className="rec-stack">
                <motion.div key={`badge-${activeIndex}`} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{duration:0.3}}>
                  <span className="rec-badge">{active.organization}</span>
                </motion.div>
                <motion.h2 key={`title-${activeIndex}`} className="rec-title" initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{duration:0.3,delay:0.05}}>
                  {active.title}
                </motion.h2>
                <motion.p key={`sub-${activeIndex}`} className="rec-subtitle" initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{duration:0.3,delay:0.1}}>
                  {active.subtitle}
                </motion.p>
                <motion.p key={`desc-${activeIndex}`} className="rec-desc" initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{duration:0.3,delay:0.15}}>
                  {active.description}
                </motion.p>
                
              </div>
            </div>
          </div>

          {/* Right: cards */}
          <div className="rec-right">
            <div ref={scrollContainerRef} onMouseMove={handleMouseMove} className="rec-scroll">
              <div className="rec-cards-row">
                {recognitions.map((item, index) => (
                  <motion.a
                    key={index}
                    href={item.blogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() => {
                      setActiveIndex(index);
                    }}
                    className="rec-card-btn"
                    whileHover={{scale:1.05,y:-8}}
                    transition={{duration:0.4,ease:[0.34,1.56,0.64,1]}}
                    style={{textDecoration:'none',display:'block'}}
                  >
                    <div className={`rec-card${activeIndex===index?' active':''}`}>
                      <img src={item.image} alt={item.title} style={{width:'100%',height:'100%',objectFit:'contain'}} />
                    </div>
                  </motion.a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}



/* ============================================================
   FOUNDER
   ============================================================ */

function FounderSection(){
  <h1>Healthy Thins</h1>
  const reducedMotion = useReducedMotion();
  const viewProps = (delay = 0) => (
    reducedMotion
      ? { initial: false, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0 } }
      : { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.7, delay } }
  );

  const founders = [
    {
      img: founderTejaswini.src, name: "G Tejaswini", role: "Founder & Managing Director",
      line: "A personal journey with gut health led her to reimagine snacking through coconut flour nutrition.",
    },
    {
      img: founderSridhar.src, name: "T N Sridhar", role: "Co-Founder & CEO",
      line: "After overcoming diabetes through diet change, he champions healthier food habits at every age.",
    },
  ];

  return (
    <section id="founders" className="fnd-section-condensed" aria-labelledby="founders-heading">
      <div className="fnd-condensed-container">
        <motion.header className="fnd-condensed-header" {...viewProps()}>
          <span className="fnd-condensed-label">  Meet the Founders</span>
          <h2 id="founders-heading" className="fnd-condensed-title">Two journeys. <span>One mission.</span></h2>
        </motion.header>

        <div className="fnd-condensed-grid">
          {founders.map((f, i) => (
            <motion.div className="fnd-condensed-card" key={f.name} {...viewProps(0.15 * i)}>
              <div className="fnd-condensed-photo-frame">
                <SafeImage src={f.img} alt={f.name} fill style={{ objectFit: "cover" }} sizes="(max-width: 768px) 100vw, 33vw" />
              </div>
              <h3 className="fnd-condensed-name">{f.name}</h3>
              <p className="fnd-condensed-role">{f.role}</p>
              <p className="fnd-condensed-line">{f.line}</p>
            </motion.div>
          ))}
        </div>

        <motion.div className="fnd-condensed-cta-wrap" {...viewProps(0.3)}>
          <Link href="/our-story/about" className="fnd-condensed-cta">
            Know More
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};


/* ============================================================
   COMMUNITY
   ============================================================ */

function CommunityShowcase(){
  const [isMounted, setIsMounted] = useState(false);
  const videoScrollRef = useRef(null);
  const animationFrameRef = useRef(null);
  const targetScrollRef = useRef(0);
  const currentScrollRef = useRef(0);

  useEffect(() => { setIsMounted(true); }, []);

  // Process Instagram embeds after mount
  useEffect(() => {
    if (!isMounted) return;
    // Load Instagram embed script dynamically if not already loaded
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    } else {
      const script = document.createElement('script');
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      script.onload = () => {
        if (window.instgrm) window.instgrm.Embeds.process();
      };
      document.body.appendChild(script);
    }
  }, [isMounted]);

  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isMounted) return;
    const animate = () => {
      if (!videoScrollRef.current || isScrollingRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      const diff = targetScrollRef.current - currentScrollRef.current;
      currentScrollRef.current += diff * 0.08;
      videoScrollRef.current.scrollLeft = currentScrollRef.current;
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isMounted]);

  // Scroll video cards to center (card 3) when section comes into view
  useEffect(() => {
    if (!isMounted) return;
    const container = videoScrollRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Find card 3 (index 2) and center it
            const cards = container.querySelectorAll('.com-video-card-wrap');
            if (cards[2]) {
              const card = cards[2];
              const scrollTo = card.offsetLeft - (container.offsetWidth / 2) + (card.offsetWidth / 2);
              container.scrollLeft = scrollTo;
              currentScrollRef.current = scrollTo;
              targetScrollRef.current = scrollTo;
            }
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [isMounted]);

  // Detect when user is manually scrolling (touch or touchpad)
  useEffect(() => {
    if (!isMounted) return;
    const container = videoScrollRef.current;
    if (!container) return;
    const onScroll = () => {
      isScrollingRef.current = true;
      currentScrollRef.current = container.scrollLeft;
      targetScrollRef.current = container.scrollLeft;
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 150);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [isMounted]);

  const handleVideoMouseMove = (e) => {
    // Only apply cursor scroll on non-touch devices
    if (window.matchMedia('(hover: none)').matches) return;
    if (!videoScrollRef.current) return;
    const container = videoScrollRef.current;
    const rect = container.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    targetScrollRef.current = pct * (container.scrollWidth - rect.width);
  };

  if (!isMounted) {
    return <section className="com-section"><div className="com-container" style={{height:'600px'}}></div></section>;
  }

  return (
    <section className="com-section">
      <div className="com-decor">
        <motion.div className="com-decor-leaf" animate={{rotate:[0,5,0],scale:[1,1.05,1]}} transition={{duration:8,repeat:Infinity,ease:'easeInOut'}}>
          <svg viewBox="0 0 200 200" fill="none"><path d="M100 20 Q120 60, 140 100 Q120 140, 100 180 Q80 140, 60 100 Q80 60, 100 20" fill="#C9A45B" opacity="0.3"/><path d="M100 20 Q110 60, 120 100 Q110 140, 100 180" stroke="#C9A45B" strokeWidth="2" opacity="0.5"/></svg>
        </motion.div>
        <motion.div className="com-decor-sparkle" animate={{scale:[1,1.5,1],opacity:[0.3,0.8,0.3],rotate:[0,180,360]}} transition={{duration:4,repeat:Infinity,ease:'easeInOut'}}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M20 0L22 18L20 40L18 18L20 0Z" fill="#D8C3A5" opacity="0.6"/><path d="M0 20L18 22L40 20L18 18L0 20Z" fill="#D8C3A5" opacity="0.6"/></svg>
        </motion.div>
        <motion.div className="com-decor-dot1" animate={{y:[0,-30,0],opacity:[0.3,0.8,0.3]}} transition={{duration:5,repeat:Infinity,ease:'easeInOut'}} />
        <motion.div className="com-decor-dot2" animate={{y:[0,20,0],opacity:[0.4,0.9,0.4]}} transition={{duration:4,repeat:Infinity,ease:'easeInOut',delay:2}} />
      </div>

      <div className="com-container">

        {/* Hero Content */}
        <motion.div className="com-left" style={{maxWidth:'720px',marginBottom:'48px'}} initial={{opacity:0,x:-50}} whileInView={{opacity:1,x:0}} viewport={{once:true}} transition={{duration:0.8}}>
          <motion.div initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6,delay:0.2}}>
            <span className="com-label">Our Community</span>
          </motion.div>
          <motion.h3 className="com-tagline" initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6,delay:0.25}}>
            Stories that inspire. <em>Moments that connect.</em>
          </motion.h3>
          <motion.p className="com-desc" initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6,delay:0.3}}>
            Every bite celebrates the goodness of coconut flour and the warmth of family traditions. Join our community in rediscovering snacking that nourishes both body and soul.
          </motion.p>
          <motion.div className="com-stats" initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6,delay:0.35}}>
            <div className="com-stat"><span className="com-stat-value">48 GI</span><span className="com-stat-label">Low Glycemic</span></div>
            <div className="com-stat"><span className="com-stat-value">4.85g</span><span className="com-stat-label">Fiber Rich</span></div>
          </motion.div>
        </motion.div>

        {/* Video section */}
        <motion.div className="com-video-section" style={{marginTop:'0'}} initial={{opacity:0}} whileInView={{opacity:1}} viewport={{once:true}} transition={{duration:0.6}}>
          <div className="com-video-bg">
            <img src={videoBg.src} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
          </div>
          <div className="com-video-inner">
            <div
              ref={videoScrollRef}
              className="com-video-scroll"
              onMouseMove={handleVideoMouseMove}
            >
              <div className="com-video-row">
                {[
                  { id: 1, offset: 40, type: 'image', src: story1.src },
                  { id: 2, offset: 20, type: 'video', src: '/video/story2.mp4' },
                  { id: 3, offset: 0,  type: 'video', src: '/video/story3.mp4' },
                  { id: 4, offset: 20, type: 'video', src: '/video/story4.mp4' },
                  { id: 5, offset: 40, type: 'image', src: story5.src },
                ].map((item, index) => (
                  <div key={index} className="com-video-card-wrap" style={{marginBottom:`${item.offset}px`}}>
                    <div className="com-video-card">

                      {item.type === 'image' ? (
                        /* Image card */
                        <img
                          src={item.src}
                          alt={`Story ${item.id}`}
                          style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',borderRadius:'24px'}}
                        />
                      ) : (
                        /* Video card */
                        <video
                          src={item.src}
                          style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',borderRadius:'24px'}}
                          loop
                          muted
                          playsInline
                          onMouseEnter={e => e.target.play()}
                          onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
                        />
                      )}

                    </div>
                  </div>
                ))}
              </div>
            </div>

            <motion.div className="com-bottom-cta" initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.6,delay:0.3}}>
              <p className="com-bottom-cta-text">Discover our community stories</p>
              <div className="com-bottom-cta-row">
                <a href="https://www.instagram.com/win_dia_foods/" target="_blank" rel="noopener noreferrer" className="com-insta-link">
                  <svg fill="currentColor" viewBox="0 0 24 24" width="28" height="28"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  <span>win_dia_foods</span>
                </a>
                <button
                  className="com-join-btn"
                  onClick={() =>
                    window.open(
                      "https://www.instagram.com/win_dia_foods/",
                      "_blank"
                    )
                  }
                >
                  <span>Join Our Family</span>
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};



/* ============================================================
   STATISTICS
   ============================================================ */
const STATS = [
  { value: 15000, suffix: '+', label: 'Happy Customers' },
  { value: 6,     suffix: '',  label: 'Product Flavours' },
  { value: 50,    suffix: '+', label: 'Cities Served' },
  { value: 4.8,   suffix: '/5', label: 'Average Rating', decimals: 1 },
]

function CountUp({ value, decimals = 0, duration = 1800, start }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (!start) return
    const startTime = performance.now()
    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(value * eased)
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [start, value, duration])

  return <>{display.toFixed(decimals)}</>
}

function StatsSection() {
  const reducedMotion = useReducedMotion()
  const sectionRef = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="stats-section" ref={sectionRef}>
      <div className="stats-container">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="stats-item"
            initial={reducedMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.12 }}
          >
            <span className="stats-value">
              <CountUp value={stat.value} decimals={stat.decimals || 0} start={inView} />
              {stat.suffix}
            </span>
            <span className="stats-label">{stat.label}</span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export default function Home(){
    return(
        <>
          <BannerStrip position="homepage" />
          <HeroSection />
        {/*<WhyUsHero/>*/}
        <WhyUsBanner></WhyUsBanner>
          <RangeCategories />
          <FeaturedProducts />
          <Testimonials />
          {/* <StatsSection /> */}
          <RecognitionSection />
          <FounderSection/>
          <CommunityShowcase/>
           <WhatsAppButton />
        </>
    )
}


