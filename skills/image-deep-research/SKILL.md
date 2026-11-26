---
name: image-deep-research
description: Image deep research and visual research - use when a question is better answered by looking than by reading. Finds reference images on open, licensed collections (Openverse, Wikimedia Commons, the Art Institute of Chicago, the Met) with the licence kept beside every one, looks at real websites, builds a moodboard and reads every picture as a picture. For design references, styles, palettes, typefaces, materials, competitors and moodboards.
argument-hint: "<topic, style, palette, typeface, competitor list, or URLs to look at>"
---

# Image deep research

Most design questions are answered by looking at twenty examples, not by
reading one article about them. This skill gets the pictures in front of
you, checks that they are real, keeps the licence beside every one, and then
makes you read them before you say anything about them.

It runs on the tools Claude already has: web search, web fetch, and a browser
when one is connected (Claude in Chrome, or the Claude desktop app's browser
pane). Ultimate Frontend Skills bundles a scripted version of this skill that
also renders sites into contact sheets and measures palettes.

The request is whatever the user typed with the skill. If it is empty, ask
one question: what should be looked at.

## The loop

Deep research here means rounds, not one search:

1. **Write the question down** in a form a picture can answer. "What do
   luxury watch sites look like" produces mush; "what ground colour, what
   headline size, and what the first screen shows on six luxury watch sites"
   produces numbers you can build with.
2. **Gather** from the two sources below: real sites for how a thing is done
   on the web, open collections for subjects, palettes, materials and art.
3. **Look**, then open only the two or three images worth a closer look.
4. **Refine and go again.** The first round tells you the right words: the
   name of the style, the photographer, the typeface, the movement. Search
   again with them. Stop when a new round stops changing the answer.
5. **Report** (see the end of this file).

## Real sites - the highest-signal source

Open each site in a browser when one is connected and look at the first
screen and one screen down, at desktop and phone widths. Without a browser,
fetch the page and read its stylesheet for colours and font families, and say
that you did not see it rendered. A page that answers with a bot challenge,
Access Denied, a preloader or an empty script shell is reported as a wall
with the reason, never guessed. A screenshot shows one moment: it does not
prove how motion feels.

Design galleries help find sites worth looking at: Awwwards, Godly,
Land-book, SiteInspire, Minimal Gallery, Curated.design, One Page Love. A
gallery's thumbnails are small and colour-shifted: look at the real site.

## Open collections

These need no account:

- Openverse (openverse.org): Creative Commons and public-domain images from
  Flickr, museums and more.
- Wikimedia Commons (commons.wikimedia.org).
- The Art Institute of Chicago (artic.edu/collection), public-domain works.
- The Met (metmuseum.org/art/collection), Open Access works.

For every image keep: title, creator, licence, licence URL, source page and
image URL. Open the image URL before reporting it; one that does not load as
an image is left out. For commercial work keep only licences that allow
commercial use and changes (drop NC and ND). A licence shown in search
results is the source's claim, not clearance: read it on the source page.
Unsplash and Pexels images are fine too, under their own licences.

## Moodboard

Write the moodboard as a Markdown or HTML page in the folder the person
chooses: each chosen image numbered, with its creator, licence and source
link under it, so the person can say which to keep.

## Reading what you got

Go in with the question from step 1. Worth extracting every time: the type
pairing and sizes, the ground colours, where the accent appears, section
rhythm, what the first screen does, and the one move you have not seen
before. Say whether each claim comes from looking or from the page's code.

## Report

- Where the moodboard is.
- Every image you recommend with its URL, creator, licence and source page.
  Nothing without a licence goes in a deliverable.
- Per reference, the one concrete move worth taking, with the number (a
  colour, a size, a spacing) when there is one.
- What could not be seen (walls, empty pages, broken images), said plainly.

## Do not

Do not describe an image you have not opened. Do not treat a gallery
thumbnail as evidence of colour. Do not conclude a site uses a library
because the effect looks like it. Do not ship an image whose licence you have
not read, and do not drop the attribution a CC BY licence requires. Never
sign in anywhere for the person or use any of their credentials.
