/* ============================================================
   Chart Enhancement Layer
   Load AFTER libs/echarts.min.js and BEFORE page scripts.

   Wraps echarts.init so every chart on the site automatically
   gets consistent usability upgrades without touching each
   page's chart code:
     - tooltips confined to the canvas (no off-screen tooltips
       on phones)
     - fatter, easier-to-grab dataZoom sliders on touch devices
     - a toolbox (save image / box zoom / reset) on desktop
     - scrollable legends on small screens
     - automatic resize via ResizeObserver + orientation change
   ============================================================ */
(function () {
    if (!window.echarts) return;

    var isMobile = function () {
        return window.innerWidth <= 768 ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    };
    var isDark = function () {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    };
    var isZh = function () {
        return (localStorage.getItem('siteLang') || 'en') === 'zh';
    };

    var asArray = function (v) {
        return Array.isArray(v) ? v : (v ? [v] : []);
    };

    function enhanceOption(option) {
        if (!option || typeof option !== 'object') return option;
        var mobile = isMobile();
        var dark = isDark();

        // --- Tooltip: never overflow the chart (critical on phones) ---
        asArray(option.tooltip).forEach(function (tp) {
            if (tp.confine === undefined) tp.confine = true;
            // Tap shows tooltip on touch screens
            if (tp.triggerOn === undefined) tp.triggerOn = 'mousemove|click';
        });

        // --- dataZoom sliders: bigger touch targets ---
        asArray(option.dataZoom).forEach(function (dz) {
            var isSlider = dz.type === 'slider' || dz.show === true;
            if (isSlider) {
                if (mobile) {
                    dz.height = Math.max(dz.height || 0, 28);
                    if (dz.moveHandleSize === undefined) dz.moveHandleSize = 10;
                    dz.brushSelect = false; // drag = move window, not brush
                } else {
                    dz.height = Math.max(dz.height || 0, 22);
                }
                if (dz.handleSize === undefined) dz.handleSize = '120%';
            }
        });

        // --- Legend: scrollable when space is tight ---
        asArray(option.legend).forEach(function (lg) {
            if (mobile && lg.type === undefined) lg.type = 'scroll';
        });

        // --- Toolbox on desktop: save image / box zoom / reset ---
        if (!mobile && option.series && option.toolbox === undefined) {
            var features = {
                saveAsImage: {
                    title: isZh() ? '保存图片' : 'Save as image',
                    backgroundColor: dark ? '#11131c' : '#ffffff'
                },
                restore: { title: isZh() ? '还原' : 'Reset' }
            };
            if (asArray(option.dataZoom).length) {
                features.dataZoom = {
                    yAxisIndex: 'none',
                    title: {
                        zoom: isZh() ? '框选缩放' : 'Box zoom',
                        back: isZh() ? '撤销缩放' : 'Undo zoom'
                    }
                };
            }
            option.toolbox = {
                show: true,
                right: 8,
                top: 0,
                itemSize: 15,
                itemGap: 10,
                iconStyle: { borderColor: dark ? '#94a3b8' : '#64748b' },
                emphasis: { iconStyle: { borderColor: '#0071e3' } },
                feature: features
            };
        }

        return option;
    }

    var instances = [];
    var origInit = echarts.init;

    echarts.init = function (dom, theme, opts) {
        var chart = origInit.call(echarts, dom, theme, opts);
        instances.push(chart);

        // Keep the chart sized to its container (covers rotation,
        // panel resizes and layout shifts the page forgot to handle).
        if (window.ResizeObserver && dom) {
            var pending = null;
            var ro = new ResizeObserver(function () {
                if (pending) cancelAnimationFrame(pending);
                pending = requestAnimationFrame(function () {
                    if (!chart.isDisposed()) chart.resize();
                    else ro.disconnect();
                });
            });
            ro.observe(dom);
        }

        var origSetOption = chart.setOption;
        chart.setOption = function (option) {
            arguments[0] = enhanceOption(option);
            return origSetOption.apply(chart, arguments);
        };
        return chart;
    };

    window.addEventListener('orientationchange', function () {
        setTimeout(function () {
            instances.forEach(function (c) {
                if (!c.isDisposed()) c.resize();
            });
        }, 300);
    });
})();
