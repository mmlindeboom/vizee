import { sum, extent, group } from 'd3-array'


// #################################################
//  example usage:
//  | const records = [{ date: '11/12/2015', value: 100, label: 'price'}...]
//  | const priceDataSet = dataset(records)
//  | priceDataSet
//  |   .columns(['date', 'label'])
//  | let rows = priceDataSet.rows() //[{ data: ...}]
// #################################################


export default function(data) {
  const _dataset = dataset(data)
  return _dataset
}

function dataset(data) {
  let columns, records, rows

  records = data
  rows = toRows(records)

  function _dataset() {}

  _dataset.first = function() {
    return rows[0]
  }

  _dataset.last = function() {
    return rows[rows.length - 1]
  }

  _dataset.rows = function() {
    return rows
  }

  _dataset._setRows = function(_) {
    rows = _
  }

  _dataset.columns = function(_) {
    if (!arguments.length) return columns || []
    return (columns = toColumns(_, rows)), dataset
  }

  _dataset.column = function(_) {
    if (!arguments.length) return
    if (!(columns instanceof Map)) {
      columns = toColumns([_], rows)
    }

    return mapToObj(columns.get(_))
  }

  _dataset.extent = function(iterator) {
    return extent(rows, iterator)
  }

  _dataset.sum = function(iterator) {
    return sum(rows, iterator)
  }

  _dataset.values = function(key, formatter) {
    const values = rows
      .map(row => row.get(key))
      .filter((value, index, self) => self.indexOf(value) === index)

    if (formatter) return values.map(formatter)

    return values
  }

  _dataset.count = function() { return rows.length }


  /**
   * Deprecrated methods
   */

  _dataset.series = function(_) {
    if (typeof _ === 'string') {
      const set = _dataset.column(_)
      const series = []
      for (const key in set) {
        series.push({key: key, values: set[key]})
      }
      return series
    }

    return _dataset.columns()
  }

  _dataset.vectors = _dataset.rows()
  _dataset.rollups = [{value: _dataset.values('date').length}]
  
  return _dataset
}



function toRows(records) {
  const rows = records.map((c) => {
    const column = new Map();

    for (const key in c) {

      column.set(key, c[key]);
    }

    return column;
  });

  return rows
}


function toColumns(dimensions, rows) {
  const groupBy = new Set(dimensions);
  const columnBy = new Map();

  groupBy.forEach((dimension) => {

    const column = group(rows, v => v.get(dimension))

    columnBy.set(dimension, column);
  });

  return columnBy;
};


function mapToObj(strMap) {
  let obj = Object.create(null);
  for (let [k,v] of strMap) {
      // We don’t escape the key '__proto__'
      // which can cause problems on older engines
      obj[k] = v;
  }
  return obj;
}

