import { LitElement, html, svg, css } from 'lit-element'
import { select } from 'd3-selection'
import { scaleBand, scaleTime, scaleOrdinal, scaleLinear } from 'd3-scale'
import { axisBottom, axisLeft, axisRight, axisTop } from 'd3-axis'
import dataset from '../dataset'
import { line, curveMonotoneX } from 'd3-shape';


//////////////////////
// PRIVATE 
//////////////////////

function toMargins(marginsStr) {
  const marginsArr = marginsStr.split(' ')
  if (marginsArr.length === 4) {
    return {
      top: parseInt(marginsArr[0]),
      right: parseInt(marginsArr[1]),
      bottom: parseInt(marginsArr[2]),
      left: parseInt(marginsArr[3])
    }
  } else {
    return false
  }
}

const UID = function () {
  // Math.random should be unique because of its seeding algorithm.
  // Convert it to base 36 (numbers + letters), and grab the first 9 characters
  // after the decimal.
  return '_' + Math.random().toString(36).substr(2, 9);
}


function CTXStore() {
  let contexts

  function _ctxStore() {
    contexts = []
  }

  _ctxStore.add = function(ctx) {
    contexts[ctx.uid()] = ctx
  }

  _ctxStore.get = function(uid) {
    return contexts[uid]
  }

  return _ctxStore
}


const ctxStore = CTXStore()

function Context() {
  let data = []
  let margins = {top: 0, right: 0, bottom: 0, left: 0}
  let height,
      plotHeight,
      plotWidth,
      uid,
      width,
      xAxis,
      xScale,
      yAxis,
      yScale

  function _context() {
    uid = UID()
  }

  _context.data = function(_, columns) {
    if (!arguments.length) return data
    //TODO: make columns dynamic
    const ds = dataset(_)
    ds.columns(['value', 'date'])

    return (data = ds), _context
  }

  _context.height = function(_) {
    if (!arguments.length) return height

    return (height = _), _context
  }

  _context.width = function(_) {
    if (!arguments.length) return width

    return (width = _), _context
  }

  _context.plotHeight = function() {
    if (!height) return 0

    return height - (margins.top + margins.bottom)
  }

  _context.plotWidth = function() {
    if (!width) return 0

    return width - (margins.left + margins.right)
  }

  _context.margins = function(_) {
    if (!arguments.length) return margins

    return (margins = toMargins(_)), _context
  }

  _context.uid = function() {
    return uid
  }

  _context.xAxis = function(_) {
    if (!arguments.length) return xAxis
    return (xAxis = _), _context
  }
  _context.yAxis = function(_) {
    if (!arguments.length) return yAxis
    return (yAxis = _), _context
  }
  _context.yScale = function(_) {
    if (!arguments.length) return yScale

    return (yScale = _), _context
  }
  _context.xScale = function(_) {
    if (!arguments.length) return xScale
    return (xScale)
  }

  return _context
}

class VizElement extends LitElement {
  connectedCallback() {
    super.connectedCallback()
    this.context = ctxStore.get(this.uid)
  }
}

class Plot extends VizElement {
  _setUids(ctx) {
    Array.from(this.children).forEach(child => child.setAttribute('uid', ctx.uid()))
  }

  connectedCallback() {
    super.connectedCallback()
    this._setUids(this.context)
  }
}

//////////////////////
// EXPORTS 
//////////////////////

export class Chart extends LitElement {
  static get properties() {
    return {
      width: { type: Number },
      height: { type: Number },
      data: { type: Array },
      margins: { type: String }
    }
  }

  _setUids(ctx) {
    Array.from(this.children).forEach(child => child.setAttribute('uid', ctx.uid()))
  }
  
  connectedCallback() {
    super.connectedCallback()

    const ctx = Context()

    // Initialize Context and ContextStore
    ctx() // TODO: why am I doing this, make it a class I guess?
    ctxStore() // TODO: same as above

    ctx
      .margins(this.margins)
      .width(this.width)
      .height(this.height)
      .data(this.data)
    
    ctxStore.add(ctx)
    this._setUids(ctx)
  }

  render() {
     return html`
        <slot name="legend"><h2>This is a legend</h2></slot>
        <slot name="plot"></slot>
     `
  }
}


export class XYPlot extends Plot {
  static get properties() {
    return {
      uid: { type: String }
    }
  }
  connectedCallback() {
    super.connectedCallback()
    this.margins = this.context.margins()
    this.width = this.context.plotWidth()
    this.height = this.context.plotHeight()
    this.data = this.context.data()
  }
  
  render() {
    return svg`
      <svg height="${this.context.height()}" width="${this.context.width()}">
        <g class="plot xy" transform="translate(${this.margins.left}, ${this.margins.top})">
          ${Array.from(this.children).map(layer => layer.render())}
        </g>
      </svg>`
  } 
}


class Axis extends VizElement {
  static get properties() {
    return {
      uid: { type: String },
      vector: { type: String },
      scale: { type: String }
    }
  }
  
  get accessor() {
    return (d) => d.get(this.vector)
  }

  //override
  attachAxis() {}
  
  axisType(direction) {
    const axes = {
      top: axisTop,
      right: axisRight,
      bottom: axisBottom,
      left: axisLeft
    }
    
    return axes[direction]()
  }
  
  get _scale() {
    const scales = {
      linear: scaleLinear,
      time: scaleTime
    }
    
    return (scales[this.scale] || scaleLinear)()
  }


}


export class YAxis extends Axis {
  
  async attachAxis() {
    const data = this.context.data()
    const height = this.context.plotHeight()
    const width = this.context.plotWidth()
    const extent = data.extent(this.accessor)
    const scale = this._scale.domain(extent).range([height, 0])

    const axis = this.axisType('left').scale(scale).tickSize(-width)
    
    await this.updateComplete
    
    select(this.parentElement.renderRoot.querySelector('.y-axis')).call(axis)
  }
  
  render() {
    this.attachAxis()
    
    return svg`
      <g class="y-axis" />
    `
  }
}

export class XAxis extends Axis {
  
  async attachAxis() {

    const data = this.context.data()
    const height = this.context.plotHeight()
    const width = this.context.plotWidth()
    
    const accessor = d => new Date(d.get(this.vector))
    const extent = data.extent((d) => new Date(this.accessor(d)))
    const scale = this._scale.domain(extent).range([0, width])
    
    const axis = this.axisType('bottom').scale(scale)
    
    await this.updateComplete
    
    select(this.parentElement.renderRoot.querySelector('.x-axis')).call(axis)
  }
  
  render() {
    this.attachAxis()
    
    return svg`
      <g class="x-axis" transform="translate(0, ${this.context.plotHeight()})"/>
    `

  }
}

export class TrendLine extends VizElement {
  static get properties() {
    return {
      uid: { type: String },
      x: { type: String },
      y: { type: String }
    }
  }
  
  render() {
    const dataset = this.context.data()
    const margins = this.context.margins()
    const height = this.context.plotHeight()
    const width = this.context.plotWidth()
    const x = this.x
    const y = this.y
    const xAccessor = d => new Date(d.get(x)) //abstract Date for TimeAxis
    const yAccessor = d => d.get(y)
    
    const extent = dataset.extent((d) => new Date(yAccessor(d)))
    const yScale = scaleLinear().domain(extent).range([height, 0])
    const dates = dataset.extent(xAccessor)
    const xScale = scaleTime().domain(dates).range([0, width])

    const d = line()
      .x((d) => xScale(xAccessor(d)))
      .y((d) => yScale(yAccessor(d)))

    return svg`
      <g class="trend">
        <path stroke="#000" fill="none" d="${d(dataset.rows())}"/>
      </g>
    `
  }
}


// export class PiePlot extends VizElement {
//   static get properties() {
//     return {
//       data: { type: Array },
//       width: { type: Number },
//       height: { type: Number },
//       total: { type: Number }
//     }
//   }
//   connectedCallback() {
//     super.connectedCallback()
//     this.drawPie()
//   }

//   async drawPie() {
//     await this.updateComplete
//     const totalAccessor = (d) => d.get(this.vector)
//     const colorAccessor = (d) => d.get('name')
//     const width = this.width
//     const height = this.height
//     const total = this.total || 100
//     const data = this.data
//     const config = {
//       data: () => data,
//       accessors: {
//         sliceAccessor: totalAccessor,
//         colorAccessor: colorAccessor
//       },
//       options: {
//         animate: true
//       },
//       width: () => width,
//       height: () => height
//     }
//     pie(this.renderRoot.querySelector('g'), config)
//   }

//   render() {
//     return svg`
//       <svg height="${this.height}" width="${this.width}">
//         <g class="plot pie" transform="translate(${this.width/2}, ${this.height/2})">
//           <g class="labels">
//             ${Array.from(this.children).map(label=> label.render())}
//           </g>
//         </g>
//       </svg>`
//   } 
// }


// export class Lines extends VizElement {
//   static get properties() {
//     return {
//       width: { type: Number },
//       height: { type: Number },
//       vector: { type: String },
//     }
//   }
//   get config() {
//     const data = dataset([{ date: '9/12/2015', value: 0, name: 'price'}, { date: '10/12/2015', value: 100, name: 'price'}, { date: '11/13/2015', value: 10, name: 'price'}])
//     data.columns(['date', 'name'])
    
//     const dateAccessor = (d) => new Date(d.get('date'))
//     const valueAccessor = (d) => d.get('value')
//     const width = this.width
//     const height = this.height
//     const vector = this.vector
    
//     return {
//       data: () => data,
//       accessors: {
//         xAccessor: dateAccessor,
//         yAccessor: valueAccessor
//       },
//       scales: {
//         xScale: scaleTime().domain(data.extent(dateAccessor)).range([0, width]),
//         yScale: scaleLinear().domain(data.extent(valueAccessor)).range([height, 0])
//       },
//       width: () => width,
//       height: () => height,
//       vector: vector
//     }
//   }
  
//   async drawLines() {
//     await this.updateComplete
//     lines(select(this.parentElement.renderRoot.querySelector('.lines')), this.config)
//   }
  
//   render() {
//     this.drawLines()
//     return svg`<g class="lines"></g>`
//   }
// }

// export class PieLabel extends LitElement {
//   static get properties() {
//     return {
//       x: { type: String },
//       y: { type: String },
//       size: { type: Number },
//       class: { type: String }
//     }
//   }

//   render() {
//     return svg`<text x="${this.x}" y="${this.y}" dx="-20" dy="10" style="font-size: 50px">${this.innerText}</text>`
//   }
// }