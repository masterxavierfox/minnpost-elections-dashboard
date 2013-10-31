(function(App, $, undefined) {

  App.prototype.ApplicationView = Ractive.extend({
    init: function() {
    }
  });

  App.prototype.FootnoteView = Ractive.extend({
    init: function() {
    }
  });

  App.prototype.ContestBaseView = Ractive.extend({
    makeMap: function(id, boundaries) {
      var thisView = this;
      var featureGroup;
      var shapes;

      boundaries = _.isArray(boundaries) ? boundaries : [boundaries];
      shapes = _.map(boundaries, function(b) {
        return b.simple_shape;
      });

      this.map = new L.Map(id, {
        zoom: 10,
        center: [44.9800, -93.2636],
        scrollWheelZoom: false
      });
      this.map.attributionControl.setPrefix(false);
      this.map.addLayer(new L.tileLayer('//{s}.tiles.mapbox.com/v3/minnpost.map-wi88b700/{z}/{x}/{y}.png'));

      // Make GeoJSON layer from shapes
      featureGroup = new L.featureGroup();
      _.each(shapes, function(s) {
        var layer = new L.geoJson(s);
        // Set style here
        featureGroup.addLayer(layer);
      });
      this.map.addLayer(featureGroup);

      // Fit bounds breaks stuff because the geojson is not necessarily
      // fully loaded in the map, so we wrap this timer around it, as
      // Leaflet does not provide an sort of mechanism to allow us to know
      // when the layer is fully loaded
      window.setTimeout(function() {
        thisView.map.fitBounds(featureGroup.getBounds());
      }, 500);
    },

    // Handle title change for document title
    observeTitle: function(originalTitle) {
      this.observe('title', function(newValue, oldValue) {
        if (newValue) {
          document.title = (originalTitle) ? newValue + ' | ' + originalTitle :
            newValue;
        }
      });
    }
  });

  App.prototype.DashboardView = App.prototype.ContestBaseView.extend({
    init: function() {
      var thisView = this;
      var $contestSearch = $(this.el).find('#contest-search');
      // Query can be either a contest or candidate
      var query = "http://ec2-54-221-171-99.compute-1.amazonaws.com/?box=ubuntu&q=" +
        "SELECT title AS title, title AS search FROM contests AS c WHERE " +
        "c.title LIKE '%%QUERY%' " +
        "UNION " +
        "SELECT r.candidate || ' (' || c.title || ')' AS title, c.title AS search " +
        "FROM results AS r " +
        "JOIN contests AS c ON r.contest_id = c.contest_id " +
        "WHERE r.candidate LIKE '%%QUERY%' ORDER BY title LIMIT 20 ";

      // Attach formatters
      this.set('fNum', _.formatNumber);

      // Make typeahead functionality for search
      $contestSearch.typeahead({
        name: 'Contests and Candidates',
        remote: {
          url: query,
          dataType: 'jsonp',
          jsonpCallback: 'mpServerSideCachingHelper',
          replace: function(url, uriEncodedQuery) {
            return url.replace(new RegExp(this.wildcard, 'g'), uriEncodedQuery);
          }
        },
        valueKey: 'title'
      });

      // Handle search selected
      $contestSearch.on('typeahead:selected', function(e, data, name) {
        thisView.app.router.navigate('/search/' + data.search, { trigger: true });
      });

      // Teardown event to remove typeahead gracefully
      this.on('teardown', function() {
        $contestSearch.typeahead('destroy');
      });

      // Mark if geolocation is availablle
      this.set('geolocationEnabled', (_.isObject(navigator) && _.isObject(navigator.geolocation)));
    }
  });

  App.prototype.ContestView = App.prototype.ContestBaseView.extend({
    init: function() {
      this.set('classes', 'contest-view');

      // Attach formatters
      this.set('fNum', _.formatNumber);

      // Make a map if boundary has been found
      this.observe('boundarySets', function(newValue, oldValue) {
        if (_.isArray(newValue) && _.isObject(newValue[0])) {
          this.makeMap('contest-map-' + this.get('id'), newValue);
        }
      });
    }
  });

  App.prototype.ContestsView = App.prototype.ContestBaseView.extend({
    init: function() {
      var thisView = this;
      var shapes = [];

      // Attach formatters
      this.set('fNum', _.formatNumber);

      // React to boundary update
      this.observe('models.0.fetchedBoundary', function(newValue, oldValue) {
        var testModel = this.get('models.0.boundarySets');
        if (_.isArray(testModel) && _.isObject(testModel[0])) {
          _.each(this.get('models'), function(m) {
            _.each(m.get('boundarySets'), function(b) {
              shapes.push(b);
            });
          });
          this.makeMap('contests-map', shapes);
        }
      });
    }
  });

})(mpApps['minnpost-elections-dashboard'], jQuery);