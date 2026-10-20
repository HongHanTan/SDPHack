export interface AsciiGrid {
  ncols: number;
  nrows: number;
  /** Lower-left corner of the lower-left cell (metres). */
  xll: number;
  yll: number;
  cellsize: number;
  nodata: number | null;
  /** Row-major, row 0 = SOUTH (engine orientation). */
  values: Float32Array;
}

/** ESRI ASCII grid (rows north → south in the file). Throws an Error with a readable message when malformed. */
export function parseAsciiGrid(text: string): AsciiGrid {
  const tokens = text.split(/\s+/).filter(Boolean);
  const header: Record<string, number> = {};
  let k = 0;
  while (k < tokens.length && /^[a-z_]+$/i.test(tokens[k])) {
    header[tokens[k].toLowerCase()] = Number(tokens[k + 1]);
    k += 2;
  }
  const ncols = header.ncols;
  const nrows = header.nrows;
  const cellsize = header.cellsize;
  if (!(ncols > 0 && nrows > 0 && cellsize > 0)) throw new Error('Height file: ncols, nrows and cellsize are required.');
  const xll = 'xllcorner' in header ? header.xllcorner : header.xllcenter - cellsize / 2;
  const yll = 'yllcorner' in header ? header.yllcorner : header.yllcenter - cellsize / 2;
  if (!Number.isFinite(xll) || !Number.isFinite(yll)) throw new Error('Height file: xllcorner/yllcorner (or xllcenter/yllcenter) are required.');
  const body = tokens.slice(k).map(Number);
  if (body.length !== ncols * nrows) throw new Error(`Height file: expected ${ncols * nrows} values, found ${body.length}.`);
  if (body.some((v) => !Number.isFinite(v))) throw new Error('Height file: non-numeric value in the grid.');
  const values = new Float32Array(ncols * nrows);
  for (let r = 0; r < nrows; r++) {
    const south = nrows - 1 - r;
    for (let c = 0; c < ncols; c++) values[south * ncols + c] = body[r * ncols + c];
  }
  return { ncols, nrows, xll, yll, cellsize, nodata: 'nodata_value' in header ? header.nodata_value : null, values };
}
