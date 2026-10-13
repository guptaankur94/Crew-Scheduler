import React, { useState } from 'react';
import { BookOpen, Coffee, Moon, Plane, SunDim, X } from 'lucide-react';

interface ScienceLabProps {
  onClose?: () => void;
  initialTopic?: string;
}

type Topic = 'naps' | 'food' | 'night' | 'light';

const TOPICS: Topic[] = ['naps', 'food', 'night', 'light'];

const FMG_URL =
  'https://www.iata.org/contentassets/39bb2b7d6d5b40c6abf88c11111fcd12/fatigue-management-guide_airline20operators.pdf';

const SourceLink: React.FC<{ href: string; label: string }> = ({ href, label }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-2 inline-block text-[11px] text-blue-400 underline underline-offset-2 hover:text-blue-300"
  >
    {label}
  </a>
);

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
    <h5 className="text-xs font-bold text-white">{title}</h5>
    <div className="mt-2 text-xs leading-relaxed text-slate-300 space-y-1">{children}</div>
  </div>
);

export const ScienceLab: React.FC<ScienceLabProps> = ({ onClose, initialTopic }) => {
  const [activeTab, setActiveTab] = useState<Topic>(
    TOPICS.includes(initialTopic as Topic) ? (initialTopic as Topic) : 'naps'
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 sm:p-6 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white sm:text-lg">The science behind the advice</h3>
            <p className="text-xs text-slate-400">What the research says, how strong it is, and where to read it</p>
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* How accurate is this? */}
      <div className="mt-4 rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 text-xs leading-relaxed text-slate-300">
        <strong className="text-blue-300">How accurate is this app?</strong> Times worked out from your roster (when to
        leave, how long you have to sleep) are exact. Advice about your body clock (the best time for light or a nap) is
        an estimate for a typical person, because no app can measure your body clock from a roster alone. Treat those
        times as a guide and adjust to how you feel.
      </div>

      {/* Navigation Pills */}
      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'naps' as Topic, label: 'Sleep & naps', icon: <Moon className="h-3.5 w-3.5" /> },
          { id: 'food' as Topic, label: 'Food & caffeine', icon: <Coffee className="h-3.5 w-3.5" /> },
          { id: 'night' as Topic, label: 'Night duty & layovers', icon: <Plane className="h-3.5 w-3.5" /> },
          { id: 'light' as Topic, label: 'Light & sunglasses', icon: <SunDim className="h-3.5 w-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {activeTab === 'naps' && (
          <>
            <Card title="How much sleep you need">
              <p>
                Most adults need about 7 hours or more in each 24 hours. What matters most is the total: a main sleep
                plus a nap works. Regularly getting 6 hours or less builds up effects people tend not to notice in
                themselves.
              </p>
              <SourceLink href="https://europepmc.org/article/MED/19194521" label="Mollicone et al. 2008" />
            </Card>
            <Card title="The NASA nap study">
              <p>
                In a 1994 NASA study, pilots on long flights given a 40-minute rest opportunity slept about 26 minutes
                on average and had fewer attention lapses and micro-sleeps afterwards. It studied 21 pilots, not cabin
                crew, and the pilots did not feel more alert even though tests showed they were.
              </p>
              <SourceLink
                href="https://ntrs.nasa.gov/api/citations/19950006379/downloads/19950006379.pdf"
                label="NASA Technical Memorandum 108839"
              />
            </Card>
            <Card title="How long to nap">
              <p>
                A 10–20 minute nap helps quickly. Naps of 30 minutes or more give more benefit but can leave you groggy
                (sleep inertia) for 15–30 minutes, sometimes longer, so allow time before safety tasks or driving.
              </p>
              <SourceLink href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6710480/" label="Hilditch & McHill 2019" />
            </Card>
            <Card title="Recovering after short sleep">
              <p>
                Recovery usually takes more than one night. The airline fatigue guide suggests two nights in a row of
                unrestricted sleep after a run of short or disrupted sleep.
              </p>
              <SourceLink href={FMG_URL} label="ICAO/IATA/IFALPA Fatigue Management Guide (2015)" />
            </Card>
          </>
        )}

        {activeTab === 'food' && (
          <>
            <Card title="Eating during your body-clock night">
              <p>
                In a trial of simulated night work, a full meal in the middle of the night worsened next-day blood-sugar
                control more than a small snack did. Have your main meal before a night duty, and choose a small snack
                if you get hungry overnight.
              </p>
              <SourceLink href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11663163/" label="Centofanti et al. 2024" />
            </Card>
            <Card title="Eating windows">
              <p>
                Eating mostly in the daytime is reasonable, but large trials find strict eating windows no better for
                weight than simply eating less. Treat any eating window as a gentle guide, and never fast through a
                duty to stay inside one.
              </p>
              <SourceLink href="https://doi.org/10.1056/NEJMoa2114833" label="Liu et al. 2022" />
            </Card>
            <Card title="Caffeine and sleep">
              <p>
                About one cup of coffee (around 100 mg) up to about 4 hours before bed had little effect on sleep in
                trials; a large dose (400 mg) should stop about 12 hours before. Caffeine disturbs daytime sleep after
                a night duty more than normal night sleep. Tea and chai count too.
              </p>
              <SourceLink href="https://pmc.ncbi.nlm.nih.gov/articles/PMC11985402/" label="Gardiner et al. 2025" />
            </Card>
            <Card title="Daily caffeine limits">
              <p>
                Up to 400 mg a day and 200 mg at a time is considered safe for most adults, or 200 mg a day in
                pregnancy.
              </p>
              <SourceLink href="https://www.efsa.europa.eu/en/topics/topic/caffeine" label="European Food Safety Authority" />
            </Card>
          </>
        )}

        {activeTab === 'night' && (
          <>
            <Card title="Your body-clock night">
              <p>
                For people adjusted to their home time, alertness is usually lowest in the early hours, roughly
                02:00–06:00. Regulators use this window too. It is an average: yours may be earlier or later, and it
                moves after travel or night work.
              </p>
              <SourceLink href={FMG_URL} label="ICAO/IATA/IFALPA Fatigue Management Guide (2015)" />
            </Card>
            <Card title="Before a night duty">
              <p>
                A nap before a night duty helps alertness more than one taken later in the night. Have coffee early in
                the duty rather than near its end, so it does not disturb the sleep that follows.
              </p>
              <SourceLink href="https://europepmc.org/article/MED/3659730" label="Dinges et al. 1987" />
            </Card>
            <Card title="Short layovers">
              <p>
                On layovers of about two days or less, your body clock barely adjusts. Flight attendants on a 50-hour
                layover had less jet lag when they kept their home sleep hours, so keep home-time sleep where you can
                and nap in the local night if needed.
              </p>
              <SourceLink href="https://europepmc.org/article/MED/9706413" label="Lowden & Åkerstedt 1998" />
            </Card>
            <Card title="Cabin crew sleep away from home">
              <p>
                In an FAA survey of over 9,000 US flight attendants, most reported fatigue on duty, sleep away from home
                was about an hour shorter than at home, and getting from the aircraft door to the hotel took 49 minutes
                on average.
              </p>
              <SourceLink
                href="https://www.faa.gov/sites/faa.gov/files/data_research/research/med_humanfacs/oamtechreports/200924.pdf"
                label="FAA CAMI report (2009)"
              />
            </Card>
          </>
        )}

        {activeTab === 'light' && (
          <>
            <Card title="Light sets your body clock">
              <p>
                Light is the strongest signal to your body clock. Bright light in the daytime and dim light in the
                evening help keep it steady.
              </p>
              <SourceLink href="https://europepmc.org/article/MED/35298459" label="Brown et al. 2022" />
            </Card>
            <Card title="Sunglasses after a night duty">
              <p>
                Night workers who wore dark sunglasses on the way home in the morning adapted better to their sleep
                schedule. Bright morning light tells your body clock it is daytime, which can make sleeping harder.
              </p>
              <SourceLink href="https://europepmc.org/article/MED/14667152" label="Crowley et al. 2003" />
            </Card>
            <Card title="Light timing is personal">
              <p>
                Light can shift your body clock earlier or later depending on when you see it, and people differ a lot
                in how strongly they respond. That is why this app keeps light advice simple and avoids exact times for
                shifting your clock.
              </p>
              <SourceLink href="https://www.pnas.org/doi/10.1073/pnas.1901824116" label="Phillips et al. 2019" />
            </Card>
            <Card title="Staying safe">
              <p>
                On layovers, get daylight from a hotel window, lobby or a busy daytime area. Never go out alone at
                night in an unfamiliar place just to follow light advice.
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
