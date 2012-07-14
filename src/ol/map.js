goog.provide('ol.Map');
goog.provide('ol.MapProperty');

goog.require('goog.array');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.events');
goog.require('goog.events.Event');
goog.require('goog.events.EventType');
goog.require('goog.math.Coordinate');
goog.require('goog.math.Size');
goog.require('goog.object');
goog.require('ol.Array');
goog.require('ol.Extent');
goog.require('ol.LayerRenderer');
goog.require('ol.Object');
goog.require('ol.Projection');


/**
 * @enum {string}
 */
ol.MapProperty = {
  CENTER: 'center',
  EXTENT: 'extent',
  LAYERS: 'layers',
  PROJECTION: 'projection',
  RESOLUTION: 'resolution',
  SIZE: 'size'
};



/**
 * @constructor
 * @extends {ol.Object}
 * @param {HTMLDivElement} target Target.
 * @param {Object=} opt_values Values.
 * @param {goog.dom.ViewportSizeMonitor=} opt_viewportSizeMonitor
 *     Viewport size monitor.
 */
ol.Map = function(target, opt_values, opt_viewportSizeMonitor) {

  goog.base(this);

  /**
   * @private
   * @type {boolean}
   */
  this.animating_ = false;

  /**
   * @private
   * @type {number}
   */
  this.freezeCount_ = 0;

  /**
   * @private
   * @type {HTMLDivElement}
   */
  this.target_ = target;

  /**
   * @private
   * @type {Array.<number>}
   */
  this.layersListenerKeys_ = null;

  /**
   * @protected
   * @type {Object.<number, ol.LayerRenderer>}
   */
  this.layerRenderers = {};

  /**
   * @private
   * @type {goog.dom.ViewportSizeMonitor}
   */
  this.viewportSizeMonitor_ = goog.isDef(opt_viewportSizeMonitor) ?
      opt_viewportSizeMonitor : new goog.dom.ViewportSizeMonitor();

  goog.events.listen(this.viewportSizeMonitor_, goog.events.EventType.RESIZE,
      this.handleViewportResize, false, this);

  goog.events.listen(
      this, ol.Object.getChangedEventType(ol.MapProperty.CENTER),
      this.handleCenterChanged, false, this);

  goog.events.listen(
      this, ol.Object.getChangedEventType(ol.MapProperty.LAYERS),
      this.handleLayersChanged, false, this);

  goog.events.listen(
      this, ol.Object.getChangedEventType(ol.MapProperty.RESOLUTION),
      this.handleResolutionChanged, false, this);

  goog.events.listen(
      this, ol.Object.getChangedEventType(ol.MapProperty.SIZE),
      this.handleSizeChanged, false, this);

  if (goog.isDef(opt_values)) {
    this.setValues(opt_values);
  }

};
goog.inherits(ol.Map, ol.Object);


/**
 * @param {ol.Layer} layer Layer.
 * @protected
 * @return {ol.LayerRenderer} layerRenderer Layer renderer.
 */
ol.Map.prototype.createLayerRenderer = goog.abstractMethod;


/**
 * @protected
 * @param {function(this: T, ol.LayerRenderer)} f Function.
 * @param {T=} opt_obj The object to be used for the value of 'this' within f.
 * @template T
 */
ol.Map.prototype.forEachLayerRenderer = function(f, opt_obj) {
  var layers = this.getLayers();
  if (goog.isDefAndNotNull(layers)) {
    layers.forEach(function(layer) {
      var key = goog.getUid(layer);
      var layerRenderer = this.layerRenderers[key];
      f.call(opt_obj, layerRenderer);
    }, this);
  }
};


/**
 */
ol.Map.prototype.freeze = function() {
  ++this.freezeCount_;
};


/**
 * @return {goog.math.Coordinate|undefined} Center.
 */
ol.Map.prototype.getCenter = function() {
  return /** @type {goog.math.Coordinate} */ (this.get(ol.MapProperty.CENTER));
};


/**
 * @param {goog.math.Coordinate} pixel Pixel.
 * @return {goog.math.Coordinate} Coordinate.
 */
ol.Map.prototype.getCoordinateFromPixel = function(pixel) {
  var center = this.getCenter();
  goog.asserts.assert(goog.isDef(center));
  var resolution = this.getResolution();
  goog.asserts.assert(goog.isDef(resolution));
  var size = this.getSize();
  goog.asserts.assert(goog.isDef(size));
  var x = center.x + resolution * (pixel.x - size.width / 2);
  var y = center.y - resolution * (pixel.y - size.height / 2);
  return new goog.math.Coordinate(x, y);
};


/**
 * @return {ol.Extent|undefined} Extent.
 */
ol.Map.prototype.getExtent = function() {
  return /** @type {ol.Extent} */ (this.get(ol.MapProperty.EXTENT));
};


/**
 * @return {ol.Array} Layers.
 */
ol.Map.prototype.getLayers = function() {
  return /** @type {ol.Array} */ (this.get(ol.MapProperty.LAYERS));
};


/**
 * @param {goog.math.Coordinate} coordinate Coordinate.
 * @return {goog.math.Coordinate} Pixel.
 */
ol.Map.prototype.getPixelFromCoordinate = function(coordinate) {
  var center = this.getCenter();
  goog.asserts.assert(goog.isDef(center));
  var resolution = this.getResolution();
  goog.asserts.assert(goog.isDef(resolution));
  var size = this.getSize();
  goog.asserts.assert(goog.isDef(size));
  var x = (coordinate.x - center.x) / resolution + size.width / 2;
  var y = (center.y - coordinate.y) / resolution + size.height / 2;
  return new goog.math.Coordinate(x, y);
};


/**
 * @return {ol.Projection} Projection.
 */
ol.Map.prototype.getProjection = function() {
  return /** @type {ol.Projection} */ (this.get(ol.MapProperty.PROJECTION));
};


/**
 * @return {number|undefined} Resolution.
 */
ol.Map.prototype.getResolution = function() {
  return /** @type {number} */ (this.get(ol.MapProperty.RESOLUTION));
};


/**
 * @param {ol.Extent} extent Extent.
 * @return {number} Resolution.
 */
ol.Map.prototype.getResolutionForExtent = function(extent) {
  var size = this.getSize();
  goog.asserts.assert(goog.isDef(size));
  var xResolution = (extent.right - extent.left) / size.width;
  var yResolution = (extent.top - extent.bottom) / size.height;
  return Math.max(xResolution, yResolution);
};


/**
 * @protected
 * @return {goog.math.Size|undefined} Size.
 */
ol.Map.prototype.getSize = function() {
  return /** @type {goog.math.Size|undefined} */ (
      this.get(ol.MapProperty.SIZE));
};


/**
 * @return {HTMLDivElement} Target.
 */
ol.Map.prototype.getTarget = function() {
  return this.target_;
};


/**
 * @protected
 */
ol.Map.prototype.handleCenterChanged = function() {
  this.recalculateExtent_();
};


/**
 * @param {ol.Layer} layer Layer.
 * @protected
 */
ol.Map.prototype.handleLayerAdd = function(layer) {
  var projection = this.getProjection();
  var storeProjection = layer.getStore().getProjection();
  goog.asserts.assert(ol.Projection.equivalent(projection, storeProjection));
  var key = goog.getUid(layer);
  var layerRenderer = this.createLayerRenderer(layer);
  if (!goog.isNull(layerRenderer)) {
    this.layerRenderers[key] = layerRenderer;
  }
};


/**
 * @param {ol.Layer} layer Layer.
 * @protected
 */
ol.Map.prototype.handleLayerRemove = function(layer) {
  var key = goog.getUid(layer);
  if (key in this.layerRenderers) {
    var layerRenderer = this.layerRenderers[key];
    delete this.layerRenderers[key];
    goog.dispose(layerRenderer);
  }
};


/**
 * @param {ol.ArrayEvent} event Event.
 * @protected
 */
ol.Map.prototype.handleLayersInsertAt = function(event) {
  var layers = /** @type {ol.Array} */ (event.target);
  var layer = /** @type {ol.Layer} */ layers.getAt(event.index);
  this.handleLayerAdd(layer);
  this.setDefaultCenterAndResolution_();
};


/**
 * @param {ol.ArrayEvent} event Event.
 * @protected
 */
ol.Map.prototype.handleLayersRemoveAt = function(event) {
  var layer = /** @type {ol.Layer} */ (event.prev);
  this.handleLayerRemove(layer);
};


/**
 * @param {ol.ArrayEvent} event Event.
 * @protected
 */
ol.Map.prototype.handleLayersSetAt = function(event) {
  var prevLayer = /** @type {ol.Layer} */ (event.prev);
  this.handleLayerRemove(prevLayer);
  var layers = /** @type {ol.Array} */ (event.target);
  var layer = /** @type {ol.Layer} */ layers.getAt(event.index);
  this.handleLayerAdd(layer);
};


/**
 */
ol.Map.prototype.handleLayersChanged = function() {
  if (!goog.isNull(this.layersListenerKeys_)) {
    goog.array.forEach(this.layersListenerKeys_, goog.events.unlistenByKey);
    this.layersListenerKeys_ = null;
  }
  var layers = this.getLayers();
  if (goog.isDefAndNotNull(layers)) {
    this.layersListenerKeys_ = [
      goog.events.listen(layers, ol.ArrayEventType.INSERT_AT,
          this.handleLayersInsertAt, false, this),
      goog.events.listen(layers, ol.ArrayEventType.REMOVE_AT,
          this.handleLayersRemoveAt, false, this),
      goog.events.listen(layers, ol.ArrayEventType.SET_AT,
          this.handleLayersSetAt, false, this)
    ];
    this.setDefaultCenterAndResolution_();
  }
};


/**
 * @protected
 */
ol.Map.prototype.handleResolutionChanged = function() {
  this.recalculateExtent_();
};


/**
 * @protected
 */
ol.Map.prototype.handleSizeChanged = function() {
  this.recalculateExtent_();
};


/**
 * @protected
 */
ol.Map.prototype.handleViewportResize = function() {
  var size = new goog.math.Size(
      this.target_.clientWidth, this.target_.clientHeight);
  this.setSize(size);
};


/**
 * @private
 */
ol.Map.prototype.recalculateExtent_ = function() {
  var size = this.getSize();
  var center = this.getCenter();
  var resolution = this.getResolution();
  if (!goog.isDef(size) || !goog.isDef(center) || !goog.isDef(resolution)) {
    return;
  }
  var left = center.x - resolution * size.width / 2;
  var right = center.x + resolution * size.width / 2;
  var bottom = center.y - resolution * size.height / 2;
  var top = center.y + resolution * size.height / 2;
  var extent = new ol.Extent(top, right, bottom, left);
  this.set(ol.MapProperty.EXTENT, extent);
};


/**
 * @protected
 */
ol.Map.prototype.redraw = function() {
  if (!this.animating_) {
    if (this.freezeCount_ === 0) {
      this.redrawInternal();
    } else {
      this.dirty_ = true;
    }
  }
};


/**
 * @protected
 */
ol.Map.prototype.redrawInternal = function() {
  this.dirty_ = false;
};


/**
 * @param {goog.math.Coordinate} center Center.
 */
ol.Map.prototype.setCenter = function(center) {
  this.set(ol.MapProperty.CENTER, center);
};


/**
 * @private
 */
ol.Map.prototype.setDefaultCenterAndResolution_ = function() {
  if (goog.isDef(this.getCenter()) && goog.isDef(this.getResolution())) {
    return;
  }
  var layers = this.getLayers();
  if (layers.getLength() < 1) {
    return;
  }
  var layer = /** @type {ol.Layer} */ (layers.getAt(0));
  var storeExtent = layer.getStore().getExtent();
  this.setExtent(storeExtent);
};


/**
 * @param {ol.Extent} extent Extent.
 */
ol.Map.prototype.setExtent = function(extent) {
  this.whileFrozen(function() {
    this.setCenter(extent.getCenter());
    this.setResolution(this.getResolutionForExtent(extent));
  }, this);
};


/**
 * @param {ol.Array} layers Layers.
 */
ol.Map.prototype.setLayers = function(layers) {
  this.set(ol.MapProperty.LAYERS, layers);
};


/**
 * @param {number} resolution Resolution.
 */
ol.Map.prototype.setResolution = function(resolution) {
  // FIXME support discrete resolutions
  this.set(ol.MapProperty.RESOLUTION, resolution);
};


/**
 * @param {goog.math.Size} size Size.
 */
ol.Map.prototype.setSize = function(size) {
  var currentSize = this.getSize();
  if (!goog.isDef(currentSize) || !goog.math.Size.equals(size, currentSize)) {
    this.set(ol.MapProperty.SIZE, size);
  }
};


/**
 * @param {ol.Projection} projection Projection.
 */
ol.Map.prototype.setProjection = function(projection) {
  this.set(ol.MapProperty.PROJECTION, projection);
};


/**
 * @param {function(this: T)} f Function.
 * @param {T=} opt_obj Object.
 * @template T
 */
ol.Map.prototype.whileFrozen = function(f, opt_obj) {
  this.freeze();
  try {
    f.call(opt_obj);
  } finally {
    this.thaw();
  }
};


/**
 */
ol.Map.prototype.thaw = function() {
  goog.asserts.assert(this.freezeCount_ > 0);
  if (--this.freezeCount_ === 0) {
    if (!this.animating_ && !this.dirty_) {
      this.redrawInternal();
    }
  }
};
