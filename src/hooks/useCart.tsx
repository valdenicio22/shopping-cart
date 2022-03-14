import {
  createContext,
  ReactNode,
  useContext,
  useReducer,
  useState,
} from 'react';
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
  cart: Product[];
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
      type: 'updateProductAmountOnCartByHomePage';
      payload: { product: Product; newAmount: Product['amount'] };
    }
  | { type: 'removeProductFromCart'; productId: Product['id'] };

const CartContext = createContext<CartContextData>({} as CartContextData);

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'updateProductAmountOnCartByHomePage': {
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
      return {
        cart: updatedCart,
      };
    }
    case 'removeProductFromCart':
      return {
        cart: state.cart.filter((product) => product.id !== action.productId),
      };
    default:
      return state;
  }
};

const initialState = (): State => {
  const storagedCart = localStorage.getItem('@RocketShoes:cart');
  if (!storagedCart) return { cart: [] };
  return { cart: JSON.parse(storagedCart) };
};

const setToLocalStorage = (updatedCart: Product[]) =>
  localStorage.setItem('@RocketShoes:cart', JSON.stringify(updatedCart));

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState());
  console.log(state);

  const [cart, setCart] = useState<Product[]>(() => {
    const storagedCart = localStorage.getItem('@RocketShoes:cart');

    if (!storagedCart) return [];
    return JSON.parse(storagedCart);
  });

  const isProductExist = (productId: Product['id']) =>
    cart.find((product) => product.id === productId);

  const itHasStock = async (productId: Product['id']) => {
    const response = await api.get<Stock>(`/stock/${productId}`);
    return response.data.amount;
  };

  const addProduct = async (productId: number) => {
    try {
      const productExist = isProductExist(productId);
      const amountOnStock = await itHasStock(productId);
      if (amountOnStock <= 0) {
        toast.error('Quantidade solicitada fora de estoque');
        return;
      }

      if (!!productExist) {
        if (amountOnStock >= productExist.amount + 1) {
          dispatch({
            type: 'updateProductAmountOnCartByHomePage',
            payload: {
              product: productExist,
              newAmount: productExist.amount + 1,
            },
          });
        } else {
          toast.error('Quantidade solicitada fora de estoque');
          return;
        }
      }

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
      else {
        const updatedCart = cart.filter(
          (productInCart) => productInCart.id !== productId
        );
        setCart(updatedCart);
        setToLocalStorage(updatedCart);
      }
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

      const updatedCart = cart.map((product) =>
        productId === product.id ? { ...product, amount: amount } : product
      );
      setCart(updatedCart);
      setToLocalStorage(updatedCart);
    } catch {
      toast.error('Erro na alteração de quantidade do produto');
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
