import { createContext, ReactNode, useContext, useReducer } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { Product, Stock } from '../types';

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface CartContextData {
  state: State;
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

type ProductData = Omit<Product, 'amount'>;

type State = {
  cart: Product[];
};
type Action =
  | {
      type: 'addToCart';
      payload: { product: ProductData; amount: Product['amount'] };
    }
  | {
      type: 'updateProductAmountOnCart';
      payload: { product: Product; newAmount: Product['amount'] };
    }
  | { type: 'removeProductFromCart'; payload: { productId: Product['id'] } };

const CartContext = createContext<CartContextData>({} as CartContextData);

function setToLocalStorage(updatedCart: Product[]) {
  localStorage.setItem('@RocketShoes:cart', JSON.stringify(updatedCart));
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'updateProductAmountOnCart': {
      const { cart } = state;
      const { newAmount, product } = action.payload;
      const updatedCart = cart.map((cartProduct) =>
        cartProduct.id === product.id
          ? {
              ...cartProduct,
              amount: newAmount,
            }
          : cartProduct
      );
      setToLocalStorage(updatedCart);
      return { cart: updatedCart };
    }
    case 'addToCart': {
      const { cart } = state;
      const { amount, product } = action.payload;
      const updatedCart = [
        ...cart,
        {
          ...product,
          amount: amount,
        },
      ];
      setToLocalStorage(updatedCart);
      return { cart: updatedCart };
    }
    case 'removeProductFromCart': {
      const updatedCart = state.cart.filter(
        (product) => product.id !== action.payload.productId
      );
      setToLocalStorage(updatedCart);
      return { cart: updatedCart };
    }
    default:
      return state;
  }
};

const initialState = (): State => {
  const storagedCart = localStorage.getItem('@RocketShoes:cart');
  if (!storagedCart) return { cart: [] };
  return { cart: JSON.parse(storagedCart) };
};

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState());

  const isProductExist = (productId: Product['id']) =>
    state.cart.find((product) => product.id === productId);

  const itHasStock = async (productId: Product['id']) => {
    const response = await api.get<Stock>(`/stock/${productId}`);
    return response.data.amount;
  };

  const addProduct = async (productId: number) => {
    try {
      const productExist = isProductExist(productId);
      const amountOnStock = await itHasStock(productId);

      if (!!productExist) {
        if (amountOnStock >= productExist.amount + 1) {
          dispatch({
            type: 'updateProductAmountOnCart',
            payload: {
              product: productExist,
              newAmount: productExist.amount + 1,
            },
          });
        } else {
          toast.error('Quantidade solicitada fora de estoque');
          return;
        }
        return;
      }

      if (amountOnStock < 1) return;
      const response = await api.get<ProductData>(`/products/${productId}`);
      const productData = response.data;
      dispatch({
        type: 'addToCart',
        payload: { product: productData, amount: 1 },
      });
    } catch {
      toast.error('Erro na adição do produto');
    }
  };

  const removeProduct = (productId: number) => {
    try {
      const productExist = isProductExist(productId);
      if (!productExist) throw Error();
      dispatch({
        type: 'removeProductFromCart',
        payload: { productId: productExist.id },
      });
    } catch {
      toast.error('Erro na remoção do produto');
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    try {
      if (amount <= 0) return;

      const productExist = isProductExist(productId);
      if (!productExist) throw Error();

      const amountOnStock = await itHasStock(productId);
      if (amount > amountOnStock) {
        toast.error('Quantidade solicitada fora de estoque');
        return;
      }

      dispatch({
        type: 'updateProductAmountOnCart',
        payload: { newAmount: amount, product: productExist },
      });
    } catch {
      toast.error('Erro na alteração de quantidade do produto');
    }
  };

  return (
    <CartContext.Provider
      value={{ state, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
