import { _decorator } from "cc";
const { ccclass } = _decorator;

@ccclass("Lodash")
export class Lodash {
  /* class member could be defined like this */
  // dummy = '';
  /**
   * Traverse the elements of the collection and return the first element whose predicate (assertion function) first returns a true value
   * @param  {any} collection A collection to iterate over
   * @param {Function} predicate Function called for each iteration.
   * @returns Returns the matching element, otherwise undefined.
   */
  public static find(collection: any, predicate: Function) {
    var result;
    if (!Array.isArray(collection)) {
      collection = Lodash._toArray(collection);
    }

    result = collection.filter(predicate);
    if (result.length) {
      return result[0];
    }

    return undefined;
  }

  private static _toArray(srcObj: any) {
    let resultArr: any[] = [];

    // to array
    for (var key in srcObj) {
      if (!srcObj.hasOwnProperty(key)) {
        continue;
      }

      resultArr.push(srcObj[key]);
    }

    return resultArr;
  }

  /**
   * Removes all elements in the array for which predicate returns true
   * @param {Array} array  A collection to iterate over.
   * @param {Function} predicate  An iterative function
   * @returns
   */
  public static remove(array: any[], predicate: Function) {
    var result: any[] = [];
    var indexes: any[] = [];
    array.forEach(function (item, index) {
      if (predicate(item)) {
        result.push(item);
        indexes.push(index);
      }
    });

    Lodash._basePullAt(array, indexes);
    return result;
  }

  private static _basePullAt(array: any[], indexes: any[]) {
    var length = array ? indexes.length : 0;
    var lastIndex = length - 1;
    var previous;

    while (length--) {
      var index = indexes[length];
      if (length === lastIndex || index !== previous) {
        previous = index;
        Array.prototype.splice.call(array, index, 1);
      }
    }

    return array;
  }
}
