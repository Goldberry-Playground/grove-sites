import { LinkButton } from "./link-button";

/** "Come learn the trees behind these recipes": workshops, U-pick, the nursery. */
export function LearnBand() {
  return (
    <section className="band" aria-labelledby="learn-head">
      <div className="page-wrap">
        <div>
          <span className="about-eyebrow">From the recipe box to the hill</span>
          <h2 id="learn-head">
            Come learn the trees <em>behind these recipes.</em>
          </h2>
          <p>
            Black walnut, hickory, pecan, persimmon, American plum, pawpaw, apple. We&rsquo;re growing them on twenty
            acres
            above Summersville and teaching what we learn as we go: native plant ID, grafting, foraging walks. Sit in
            on a workshop, pick in season, or take a few trees home from our sister nursery.
          </p>
        </div>
        <div className="band-ctas">
          <LinkButton href="/visit/seminars" variant="secondary" size="lg">
            See upcoming workshops
          </LinkButton>
          <LinkButton href="/visit/upick" variant="ghost" onDark>
            U-pick, in season
          </LinkButton>
          <LinkButton href="/recipes/trees/nursery" variant="ghost" onDark offsite>
            Trees from At The Grove Nursery
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
