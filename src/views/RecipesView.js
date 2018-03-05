import React from 'react';
import CheckBoxList from '../components/CheckBoxList';
import Counter from '../utils/Counter';
import MultilineText from '../components/MultiLineText';
import PaginatedCardGroup from '../components/PaginatedCardGroup';
import SearchBar from '../components/SearchBar';
import StarRating from '../components/StarRating';

const quantityWords = new Set([
  'oz',
  'sp',
  'pinch',
  'cup',
  'drop',
  'slice',
  'grain',
  'cm',
  'gram',
  'piece',
  'dash',
]);

const blacklistWords = new Set([
  'old',
  'syrup',
  'simple',
  'brown',
  'grand',
]);

const combinedWords = new Set([
  ' vermouth',
  ' juice',
  ' twist',
  ' bitters',
  'dry gin',
  'dry shake',
]);

const combineTokens = (sentence) => {
  for (const token of combinedWords) {
    const regexp = new RegExp(token, 'gi');
    sentence = sentence.replace(regexp, token.replace(' ', '_'));
  }

  return sentence;
};

const splitTokens = (sentence) => sentence.replace(/_/g, ' ');

const hasAny = (token, words) => {
  for (const word of words) {
    if (token.indexOf(word) !== -1) {
      return true;
    }
  }

  return false;
}

const isQuantity = (word) => hasAny(word, quantityWords);

const isBlacklisted = (word) => hasAny(word, blacklistWords);

const getFilterTerms = (recipes, numFilters) => {
  const recipeWords = [];
  recipes
    .map(recipe => recipe.Ingredients)
    .forEach(ingredients => {
      ingredients.split('\n').forEach(ingredient => {
        combineTokens(ingredient)
          .split(' ')
          .map(word => word.replace(/\([^)]*\)/g, ''))
          .map(word => splitTokens(word))
          .map(word => word.replace(/[^a-zA-Z ]/g, ''))
          .filter(word => word.length > 0)
          .map(word => word.toLowerCase())
          .filter(word => !isBlacklisted(word))
          .filter(word => !isQuantity(word))
          .forEach(word => recipeWords.push(word));
      });
    });

  const filterTerms = {};
  new Counter(recipeWords)
    .mostCommon(numFilters)
    .forEach(filterTerm => filterTerms[filterTerm] = false);

  return filterTerms;
}

const hasAllFilterTerms = (recipe, filterTerms) => {
  const searchCorpus = splitTokens(recipe.Ingredients).toLowerCase();

  return Object.entries(filterTerms)
    .filter(([filterTerm, isActive]) => isActive)
    .map(([filterTerm, isActive]) => filterTerm.toLowerCase())
    .every(searchValue => searchCorpus.indexOf(searchValue) !== -1);
}

const hasFilterText = (recipe, filterText) => {
  if (!filterText) {
    return true;
  }

  const searchCorpus = `${recipe.Name} ${recipe.Ingredients}`.toLowerCase();

  return filterText
    .split('&&')
    .map(searchTerm => searchTerm.replace(/&/g, ''))
    .map(searchTerm => searchTerm.trim())
    .map(searchTerm => searchTerm.toLowerCase())
    .every(searchTerm => searchCorpus.indexOf(searchTerm) !== -1);
};

const byRating = (recipeA, recipeB) => recipeB.Rating - recipeA.Rating;

const recipeToCard = (recipe, i) => ({
  key: `recipe-${i}`,
  header: recipe.Name,
  description: <MultilineText text={splitTokens(recipe.Ingredients)} />,
  meta: <StarRating rating={recipe.Rating} />
});

export default class App extends React.PureComponent {
  constructor(props) {
    super(props);

    let state = {};
    if (window.location.hash) {
      try {
        const serializedState = window.location.hash.replace('#/share/', '');
        state = JSON.parse(atob(decodeURIComponent(serializedState)));
      } catch (error) {
        window.location.hash = '';
      }
    }

    if (!state.filterTerms) {
      state.filterTerms = getFilterTerms(props.recipes, props.numFilters);
    }
    if (!state.filterText) {
      state.filterText = '';
    }

    this.state = state;
  }

  onSearchTermToggle = (filterTerm) => {
    const { filterTerms } = this.state;
    const newFilterTerms = Object.assign({}, filterTerms);
    newFilterTerms[filterTerm] = !newFilterTerms[filterTerm];
    this.setState({ filterTerms: newFilterTerms }, this.serializeStateToUrl);
  }

  onSearchTextChange = (filterText) => {
    const newFilterText = combineTokens(filterText);
    this.setState({ filterText: newFilterText }, this.serializeStateToUrl);
  }

  serializeStateToUrl = () => {
    const serializedState = encodeURIComponent(btoa(JSON.stringify(this.state)));
    window.location.hash = `#/share/${serializedState}`;
  }

  shouldShowRecipe = (recipe) => {
    const { filterTerms, filterText } = this.state;

    return hasAllFilterTerms(recipe, filterTerms) &&
      hasFilterText(recipe, filterText);
  }

  render() {
    const { recipes, recipesPerPage } = this.props;
    const { filterTerms, filterText } = this.state;

    const displayableRecipes = recipes
      .sort(byRating)
      .filter(this.shouldShowRecipe)
      .map(recipeToCard);

    return (
      <div>
        <CheckBoxList
          terms={filterTerms}
          onToggle={this.onSearchTermToggle}
        />
        <SearchBar
          defaultValue={filterText}
          placeholder="Search for recipes..."
          onChange={this.onSearchTextChange}
        />
        <PaginatedCardGroup
          itemsPerPage={recipesPerPage}
          items={displayableRecipes}
        />
      </div>
    );
  }
}
