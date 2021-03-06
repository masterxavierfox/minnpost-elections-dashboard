/**
 * Main application file for: minnpost-elections-dashboard
 *
 * This pulls in all the parts
 * and creates the main object for the application.
 */

// Create main application
require(['jquery', 'underscore', 'screenfull', 'base', 'helpers', 'views', 'routers',
  'mpConfig',
  'text!templates/dashboard-state-leg.mustache'],
  function($, _, screenfull, Base, helpers, views, routers, mpConfig, tDStateLeg) {

  // Create new class for app
  var App = Base.BaseApp.extend({

    defaults: {
      name: 'minnpost-elections-dashboard',
      remoteProxy: '//mp-jsonproxy.herokuapp.com/proxy?callback=?&url=',
      el: '.minnpost-elections-dashboard-container',
      // Hard page refresh, in case the interface needs to be
      // updated through the night
      interfaceRefresh: 1000 * 60 * 30,
      electionsAPIPollInterval: 50000,
      electionsAPI: '//premium.scraperwiki.com/ez47yoa/aaff8e67f921428/sql/?q=',
      // Local: '//localhost:5000/?q='
      // Custom: '//54.91.220.106/?box=ubuntu/minnpost-scraper-mn-election-results&method=sql&q='
      // ScraperWiki: '//premium.scraperwiki.com/ez47yoa/aaff8e67f921428/sql/?q='
      boundaryAPI: '//boundaries.minnpost.com/1.0/',
      boundarySets: [
        'minor-civil-divisions-2010',
        'wards-2012',
        'minnesota-state-2014',
        'school-districts-2013',
        'minneapolis-parks-and-recreation-districts-2012',
        'congressional-districts-2012',
        'state-senate-districts-2012',
        'state-house-districts-2012',
        'hospital-districts-2012',
        'district-courts-2012',
        'county-commissioner-districts-2012',
        'counties-2010'
      ],
      npParties: ['WI', 'NP'],
      // Please don't steal/abuse
      mapQuestKey: 'Fmjtd%7Cluur20a7n0%2C8n%3Do5-9a1s9f',
      mapQuestQuery: '//open.mapquestapi.com/geocoding/v1/address?key=[[[KEY]]]&outFormat=json&countrycodes=us&maxResults=1&location=[[[ADDRESS]]]',
      originalTitle: document.title,
      dashboard: [
        {
          type: 'race',
          title: 'President (Minnesota)',
          itemClass: 'president',
          id: 'id-MN----0101',
          rows: 3
        },
        {
          type: 'race',
          title: 'Congressional District 2',
          itemClass: 'congress-district',
          id: 'id-MN---2-0105',
          rows: 3
        },
        {
          type: 'race',
          title: 'Congressional District 3',
          itemClass: 'congress-district',
          id: 'id-MN---3-0106',
          rows: 2
        },
        {
          type: 'race',
          title: 'Congressional District 8',
          itemClass: 'congress-district',
          id: 'id-MN---8-0111',
          rows: 2
        },
        {
          type: 'race',
          title: 'MN Supreme Court Associate Justice',
          itemClass: 'supreme-court',
          id: 'id-MN----7007',
          rows: 2
        },
        {
          type: 'custom',
          id: 'state-sen',
          template: tDStateLeg,
          query: "SELECT r.id AS results_id, r.candidate, r.party_id, r.percentage, " +
            "c.id, c.title, c.precincts_reporting, c.total_effected_precincts, c.incumbent_party " +
            "FROM contests AS c LEFT JOIN results AS r " +
            "ON c.id = r.contest_id WHERE title LIKE '%state senator%' " +
            "ORDER BY c.title, r.percentage, r.candidate ASC LIMIT 400",
          parse: function(response, options) {
            var parsed = {};
            var tempContests = [];

            parsed.chamber = "senate";

            // Put contest info into friendly format
            parsed.contests = {};
            _.each(response, function(r, ri) {
              parsed.contests[r.id] = parsed.contests[r.id] || {
                id: r.id,
                title: r.title,
                precincts_reporting: r.precincts_reporting,
                total_effected_precincts: r.total_effected_precincts,
                incumbent_party: r.incumbent_party,
                results: []
              };
              parsed.contests[r.id].results.push({
                id: r.results_id,
                candidate: r.candidate,
                party_id: r.party_id,
                percentage: r.percentage
              });
            });

            // Process contests
            parsed.contests = _.map(parsed.contests, function(c, ci) {
              c.done = (c.precincts_reporting === c.total_effected_precincts);
              c.some = (c.precincts_reporting > 0);
              c.partyWon = _.max(c.results, function(r, ri) {
                return r.percentage;
              }).party_id;

              // Test data
              /*
              var t = Math.random();
              if (t < 0.9) {
                c.done = true;
                c.partyWon = (Math.random() < 0.5) ? 'DFL' : 'R';
              }
              */

              c.partyShift = (c.partyWon !== c.incumbent_party && c.done);
              c.results = _.sortBy(c.results, 'candidate').reverse();
              c.results = _.sortBy(c.results, 'percentage').reverse();

              return c;
            });

            // Sort contests, this could get messey
            parsed.contests = _.sortBy(parsed.contests, 'title');
            parsed.contests = _.sortBy(parsed.contests, 'partyShift').reverse();
            parsed.contests = _.sortBy(parsed.contests, function(c, ci) {
              if (c.done) {
                return (c.partyWon === 'DFL') ? 'AAAADFL' :
                  (c.partyWon === 'R') ? 'ZZZZZR' : 'MMMMMM' + c.partyWon;
              }
              else {
                return (c.some) ? 'MMMAAAAAA' : 'MMMMMM';
              }
            });

            // Counts
            parsed.counts = {};
            _.each(parsed.contests, function(c, ci) {
              if (c.done) {
                if (parsed.counts[c.partyWon]) {
                  parsed.counts[c.partyWon].count += 1;
                }
                else {
                  parsed.counts[c.partyWon] = {
                    id: c.partyWon,
                    count: 1,
                    party: mpConfig.politicalParties[c.partyWon.toLowerCase()]
                  };
                }
              }
              else {
                if (parsed.counts.unknown) {
                  parsed.counts.unknown.count += 1;
                }
                else {
                  parsed.counts.unknown = {
                    id: 'MMMMMMMunknown',
                    count: 1,
                    party: 'Not fully reported yet'
                  };
                }
              }
            });
            parsed.counts = _.sortBy(parsed.counts, 'id');

            // R net because senate is dfl controlled
            parsed.rNet = 0;
            _.each(parsed.contests, function(c, ci) {
              if (c.done && c.partyShift && c.partyWon === 'R') {
                parsed.rNet += 1;
              }
              if (c.done && c.partyShift && c.incumbent_party === 'R') {
                parsed.rNet -= 1;
              }
            });

            // Is everything done
            parsed.allDone = (_.where(parsed.contests, { done: true }).length ===
              parsed.contests.length);

            return parsed;
          }
        },
        {
          type: 'custom',
          id: 'state-leg',
          template: tDStateLeg,
          query: "SELECT r.id AS results_id, r.candidate, r.party_id, r.percentage, " +
            "c.id, c.title, c.precincts_reporting, c.total_effected_precincts, c.incumbent_party " +
            "FROM contests AS c LEFT JOIN results AS r " +
            "ON c.id = r.contest_id WHERE title LIKE '%state representative%' " +
            "ORDER BY c.title, r.percentage, r.candidate ASC LIMIT 400",
          parse: function(response, options) {
            var parsed = {};
            var tempContests = [];

            parsed.chamber = "house";

            // Put contest info into friendly format
            parsed.contests = {};
            _.each(response, function(r, ri) {
              parsed.contests[r.id] = parsed.contests[r.id] || {
                id: r.id,
                title: r.title,
                precincts_reporting: r.precincts_reporting,
                total_effected_precincts: r.total_effected_precincts,
                incumbent_party: r.incumbent_party,
                results: []
              };
              parsed.contests[r.id].results.push({
                id: r.results_id,
                candidate: r.candidate,
                party_id: r.party_id,
                percentage: r.percentage
              });
            });

            // Process contests
            parsed.contests = _.map(parsed.contests, function(c, ci) {
              c.done = (c.precincts_reporting === c.total_effected_precincts);
              c.some = (c.precincts_reporting > 0);
              c.partyWon = _.max(c.results, function(r, ri) {
                return r.percentage;
              }).party_id;

              // Test data
              /*
              var t = Math.random();
              if (t < 0.9) {
                c.done = true;
                c.partyWon = (Math.random() < 0.5) ? 'DFL' : 'R';
              }
              */


              c.partyShift = (c.partyWon !== c.incumbent_party && c.done);
              c.results = _.sortBy(c.results, 'candidate').reverse();
              c.results = _.sortBy(c.results, 'percentage').reverse();

              return c;
            });

            // Sort contests, this could get messey
            parsed.contests = _.sortBy(parsed.contests, 'title');
            parsed.contests = _.sortBy(parsed.contests, 'partyShift').reverse();
            parsed.contests = _.sortBy(parsed.contests, function(c, ci) {
              if (c.done) {
                return (c.partyWon === 'DFL') ? 'AAAADFL' :
                  (c.partyWon === 'R') ? 'ZZZZZR' : 'MMMMMM' + c.partyWon;
              }
              else {
                return (c.some) ? 'MMMAAAAAA' : 'MMMMMM';
              }
            });

            // Counts
            parsed.counts = {};
            _.each(parsed.contests, function(c, ci) {
              if (c.done) {
                if (parsed.counts[c.partyWon]) {
                  parsed.counts[c.partyWon].count += 1;
                }
                else {
                  parsed.counts[c.partyWon] = {
                    id: c.partyWon,
                    count: 1,
                    party: mpConfig.politicalParties[c.partyWon.toLowerCase()]
                  };
                }
              }
              else {
                if (parsed.counts.unknown) {
                  parsed.counts.unknown.count += 1;
                }
                else {
                  parsed.counts.unknown = {
                    id: 'MMMMMMMunknown',
                    count: 1,
                    party: 'Not fully reported yet'
                  };
                }
              }
            });
            parsed.counts = _.sortBy(parsed.counts, 'id');

            // DFL net
            parsed.dflNet = 0;
            _.each(parsed.contests, function(c, ci) {
              if (c.done && c.partyShift && c.partyWon === 'DFL') {
                parsed.dflNet += 1;
              }
              if (c.done && c.partyShift && c.incumbent_party === 'DFL') {
                parsed.dflNet -= 1;
              }
            });

            // Is everything done
            parsed.allDone = (_.where(parsed.contests, { done: true }).length ===
              parsed.contests.length);

            return parsed;
          }
        },
        {
          type: 'race',
          title: 'Constitutional Amendment',
          itemClass: 'ballot-question',
          id: 'id-MN----0351',
          rows: 3
        },
        {
          type: 'links',
          itemClass: 'dashboard-links mobile-only',
          links: [
            { href: '#search/school%20board%20member%20(ssd%20%231)', text: 'Minneapolis School Board' },
            { href: '#contest/id-MN---1-1-5031', text: 'Minneapolis school referendum' },
            { href: '#search/question', text: 'All ballot questions' }
          ]
        },
        {
          type: 'links',
          itemClass: 'dashboard-links non-mobile',
          links: [
            { href: '#search/school%20board%20member%20(ssd%20%231)', text: 'Minneapolis School Board' },
            { href: '#contest/id-MN---1-1-5031', text: 'Minneapolis school referendum' },
            { href: '#search/question', text: 'All ballot questions' }
          ]
        }
      ]
    },

    // When the app is ready to go
    initialize: function() {
      var thisApp = this;

      // Override Backbone's AJAX
      helpers.overrideBackboneAJAX();

      // Render the container and "static" templates.
      this.applicationView = new views.ApplicationView({
        el: this.$el
      });
      this.footnoteView = new views.FootnoteView({
        el: this.$el.find('.footnote-container')
      });

      // Handle fullscreen mode button.  Safari does not allow input in
      // fullscreen mode, but not sure how to tell if Safari
      this.applicationView.on('toggleFullscreen', function(e) {
        e.original.preventDefault();

        this.set('isFullscreen', !this.get('isFullscreen'));
        thisApp.$el.toggleClass('fullscreen');

        if (screenfull.enabled) {
          screenfull.toggle();
        }
      });
      // Also handle fullscreen event, actually just the Esc.  Alt-shift-F does
      // not seem to trigger an event
      if (screenfull.enabled) {
        $(document).on(screenfull.raw.fullscreenchange, function () {
          if (!screenfull.isFullscreen) {
            thisApp.applicationView.set('isFullscreen', false);
            thisApp.$el.removeClass('fullscreen');
          }
          else {
            thisApp.applicationView.set('isFullscreen', true);
            thisApp.$el.addClass('fullscreen');
          }
        });
      }

      // Create router which will handle most of the high
      // level logic
      this.router = new routers.DashboardRouter(_.extend(this.options, { app: this }));
      this.router.start();
    }
  });

  // Instantiate
  return new App({});
});
