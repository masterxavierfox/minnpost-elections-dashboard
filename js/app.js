/**
 * Main app logic for: minnpost-elections-dashboard
 */
(function(app, $, undefined) {
  // Get templates.  The get template method should be updated
  // to handle multiple templates.
  app.prototype.getTemplates = function(done, context) {
    this.getTemplate('template-application', function(compiledTemplate) {
      this.getTemplate('template-footnote', function(compiledTemplate) {
        this.getTemplate('template-loading', function(compiledTemplate) {
          done.apply(context, []);
        }, this);
      }, this);
    }, this);
  };

  // Start function that starts the application.
  app.prototype.start = function() {
    var thisApp = this;

    this.getTemplates(function() {
      this.$el.html(this.template('template-application')({ }));
      this.$el.find('.footnote-container').html(this.template('template-footnote')({ }));

      // Mark as loading
      this.$el.find('.message-container').html(this.template('template-loading')({ })).slideDown();

      // Do stuff like get data
      this.router = new this.DashboardRouter({
        app: this
      });
      this.router.start();

      // Stop loading
      this.$el.find('.message-container').slideUp(function() {
        $(this).html('');
      });

    }, this);
  };

})(mpApps['minnpost-elections-dashboard'], jQuery);