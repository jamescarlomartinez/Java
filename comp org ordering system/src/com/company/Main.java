package com.company;

import java.util.Scanner;

public class Main {

    public static void main(String[]args){
        Scanner sc = new Scanner(System.in);

        System.out.println();
        System.out.println("     |      __________________________      |");
        System.out.println("     |     |  Hi! My name is James!   |     |");
        System.out.println("     |     | Welcome to my restaurant!|     |");
        System.out.println("     |     |__________________________|     |");
        System.out.println("     |                   ^                  |");
        System.out.println("     |                   |                  |");
        System.out.println("     |            _____________             |");
        System.out.println("     |            |           |             |");
        System.out.println("     |           *|   0   0   |*            |");
        System.out.println("     |          * |  *  ^   * | *           |");
        System.out.println("     |         *  |   *---*   |  *          |");
        System.out.println("     |        *   |___________|   *         |");
        System.out.println("     |      '''       |   |       '''       |");
        System.out.println("     |                |   |                 |");
        System.out.println("     |                |   |                 |");
        System.out.println("     |              ==*   *==               |");
        System.out.println();
        String user;
        double all = 0.0;
        int answer = 0;
        int x=0;
        String customer;

        do{
            System.out.println();
            System.out.println("   -------------------------------------------------------   ");
            System.out.println("  | What is your name? First letter must be in capital. :)|  ");
            System.out.println("   -------------------------------------------------------   ");
            System.out.println();
            customer=sc.nextLine();
            char N=customer.charAt(0);
            if(Character.isLowerCase(N)){
                x=1;
            }
            else{
                x=0;
            }
            if(x==1){
                System.out.println();
                System.out.println("-->Please re-enter. Don't forget, first letter must be in uppercase.<--");
            }
        }
        while(x==1);

        System.out.println();
        System.out.println("Thank you for following the instruction, "+customer);

        int Yes=1;
        int No=2;
        System.out.println();
        System.out.println("     ---------------------------------------");
        System.out.println("       Welcome to DV Restaurant, " +customer+"!");
        System.out.println("     ---------------------------------------");
        System.out.println();
        System.out.println("     |      __________________________      |");
        System.out.println("     |     |Would you like to order?  |     |");
        System.out.println("     |     |     1-> YES 2-> NO       |     |");
        System.out.println("     |     |__________________________|     |");
        System.out.println("     |                   ^                  |");
        System.out.println("     |                   |                  |");
        System.out.println("     |            _____________             |");
        System.out.println("     |            |           |             |");
        System.out.println("     |           *|   0   0   |*  '''       |");
        System.out.println("     |          * |  *  ^   * | * *         |");
        System.out.println("     |         *  |   *---*   |  *          |");
        System.out.println("     |        *   |___________|             |");
        System.out.println("     |      '''       |   |                 |");
        System.out.println("     |                |   |                 |");
        System.out.println("     |                |   |                 |");
        System.out.println("     |              ==*   *==               |");
        System.out.println();

        answer=sc.nextInt();

        if(answer==Yes){
            System.out.println("	It's our pleasure to serve you, "+customer+" <3");
            System.out.println("	Here is the menu for today, "+customer+".");
            System.out.println();
            System.out.println("      ________________________");
            System.out.println("     |          Menu          |");
            System.out.println("     |                        |");
            System.out.println("     |       Categories       |");
            System.out.println("     |                        |");
            System.out.println("     |  1. Burgers            |");
            System.out.println("     |  2. Rice Meals         |");
            System.out.println("     |  3. Soups              |");
            System.out.println("     |  4. Desserts           |");
            System.out.println("     |  5. Drinks & Beverages |");
            System.out.println("     |                        |");
            System.out.println("     |  ...DV Restaurant      |");
            System.out.println("     |        Fine Dining...  |");
            System.out.println("     |________________________|");
            System.out.println();
            System.out.println("     ------------------------------------------------------");
            System.out.println("       In what category would you like to order "+customer+"?");
            System.out.println("     ------------------------------------------------------");

            int Category=sc.nextInt();

            switch(Category){
                case 1:
                    System.out.println("	                           Burgers                       ");
                    System.out.println();
                    System.out.println("	Code  		 Name      		Price   	   Reference Code");
                    System.out.println("	 Q1    	Classic              P60.00              1Q");
                    System.out.println("	 Q2    	Cheese               P110.00             2Q");
                    System.out.println("	 Q3   	Blue Cheese          P200.00             3Q");
                    System.out.println("	 Q4  	Caramelized Onion    P30.00              4Q");
                    System.out.println("	 Q5  	Bacon and Cheese     P80.00              5Q");
                    break;
                case 2:
                    System.out.println("	                          Rice Meals                     ");
                    System.out.println();
                    System.out.println("	Code         Name            Price         Reference Code");
                    System.out.println("	 W1     Kebab                 P110.00            1W");
                    System.out.println("	 W2     Brisket               P170.00            2W");
                    System.out.println("	 W3     Porkchop              P50.00             3W");
                    System.out.println("	 W4     2pc. Chicken          P80.00             4W");
                    System.out.println("	 W5     Chicken Fillet        P40.00             5W");
                    break;
                case 3:
                    System.out.println("	                            Soups                        ");
                    System.out.println();
                    System.out.println("	Code        Name             Price         Reference Code");
                    System.out.println("	 E1     Squash Soup           P60.00             1E");
                    System.out.println("	 E2     Bacon and Beef stew   P110.00            2E");
                    System.out.println("	 E3     Beef Soup             P200.00            3E");
                    System.out.println("	 E4     Creamy soup           P30.00             4E");
                    System.out.println("	 E5     Chicken soup          P80.00             5E");
                    break;
                case 4:
                    System.out.println("	                          Desserts                       ");
                    System.out.println();
                    System.out.println("	Code       Name               Price        Reference Code");
                    System.out.println("	 S1     Space Cake              P20.00           1S");
                    System.out.println("	 S2     Brownies                P20.00           2S");
                    System.out.println("	 S3     Frozen Yogurt           P5.00            3S");
                    System.out.println("	 S4     Cookies                 P3.00            4S");
                    System.out.println("	 S5     Cinnabon                P10.00           5S");
                    break;
                case 5:
                    System.out.println("	                      Drinks & Beverages                  ");
                    System.out.println();
                    System.out.println("	Code         Name             Price         Reference Code");
                    System.out.println("	 A1    Fruit Juice            P5.00             1A");
                    System.out.println("	 A2    Smoothie               P5.00             2A");
                    System.out.println("	 A3    Coca-Cola              P8.00             3A");
                    System.out.println("	 A4    Wine                   P30.00            4A");
                    System.out.println("	 A5    Beer                   P50.00            5A");
                    break;
                default:
                    System.out.println("That's not in our menu "+customer+".");
            }

            do{
                System.out.println();
                System.out.println("     -------------------------------------------------------");
                System.out.println("     || Enter meal code, first letter must be in CAPITAL! ||");
                System.out.println("     -------------------------------------------------------");

                user = sc.next();


                if(user.equals("Q1"))
                {all += 60.00;	 }
                else if(user.equals("Q2"))
                {all += 110.00;		  }
                else if(user.equals("Q3"))
                {all += 200.00;	 	  }
                else if(user.equals("Q4"))
                {all += 30.00;		  }
                else if(user.equals("Q5"))
                {all += 80.00;		  }
                else if(user.equals("W1"))
                {all += 110.00;		  }
                else if(user.equals("W2"))
                {all += 170.00;		  }
                else if(user.equals("W3"))
                {all += 50.00;	 	  }
                else if(user.equals("W4"))
                {all += 80.00;		  }
                else if(user.equals("W5"))
                {all += 40.00;		  }
                else if(user.equals("E1"))
                {all += 60.00;		  }
                else if(user.equals("E2"))
                {all += 110.00;		  }
                else if(user.equals("E3"))
                {all += 200.00;		  }
                else if(user.equals("E4"))
                {all += 30.00;		  }
                else if(user.equals("E5"))
                {all += 80.00;		  }
                else if(user.equals("A1"))
                {all += 5.00;		  }
                else if(user.equals("A2"))
                {all += 5.00;		  }
                else if(user.equals("A3"))
                {all += 8.00;		  }
                else if(user.equals("A4"))
                {all += 30.00;		  }
                else if(user.equals("A5"))
                {all += 50.00;		  }
                else if(user.equals("S1"))
                {all += 20.00;		  }
                else if(user.equals("S2"))
                {all += 20.00;		  }
                else if(user.equals("S3"))
                {all += 10.00;		  }
                else if(user.equals("S4"))
                {all += 10.00;		  }
                else
                {all += 10.00;}
                System.out.println("     ---------------------------------------------- ");
                System.out.println("     Your current total is: P" + all);
                System.out.println("     Would you like to order from other categories?");
                System.out.println("               1-Yes        2-No                    ");
                System.out.println("     ---------------------------------------------- ");
                answer=sc.nextInt();


                if(answer==1){
                    System.out.println();
                    System.out.println("      ________________________");
                    System.out.println("     |          Menu          |");
                    System.out.println("     |                        |");
                    System.out.println("     |       Categories       |");
                    System.out.println("     |                        |");
                    System.out.println("     |  1. Burgers            |");
                    System.out.println("     |  2. Rice Meals         |");
                    System.out.println("     |  3. Soups              |");
                    System.out.println("     |  4. Desserts           |");
                    System.out.println("     |  5. Drinks & Beverages |");
                    System.out.println("     |                        |");
                    System.out.println("     |  ...DV Restaurant      |");
                    System.out.println("     |        Fine Dining...  |");
                    System.out.println("     |________________________|");
                    System.out.println();
                    System.out.println("     ------------------------------------------------------");
                    System.out.println("       In what category would you like to order "+customer+"?");
                    System.out.println("     ------------------------------------------------------");

                    int Categ=sc.nextInt();

                    switch(Categ){
                        case 1:
                            System.out.println("	                           Burgers                       ");
                            System.out.println();
                            System.out.println("	Code  		 Name      		Price   	   Reference Code");
                            System.out.println("	 Q1    	Classic              P60.00              1F");
                            System.out.println("	 Q2    	Cheese               P110.00             2F");
                            System.out.println("	 Q3   	Blue Cheese          P200.00             3F");
                            System.out.println("	 Q4  	Caramelized Onion    P30.00              4F");
                            System.out.println("	 Q5  	Bacon and Cheese     P80.00              5F");
                            break;
                        case 2:
                            System.out.println("	                          Rice Meals                     ");
                            System.out.println();
                            System.out.println("	Code         Name            Price         Reference Code");
                            System.out.println("	 W1     Kebab                 P110.00            1C");
                            System.out.println("	 W2     Brisket               P170.00            2C");
                            System.out.println("	 W3     Porkchop              P50.00             3C");
                            System.out.println("	 W4     2pc. Chicken          P80.00             4C");
                            System.out.println("	 W5     Chicken Fillet        P40.00             5C");
                            break;
                        case 3:
                            System.out.println("	                            Soups                        ");
                            System.out.println();
                            System.out.println("	Code        Name             Price         Reference Code");
                            System.out.println("	 E1     Squash Soup           P60.00             1S");
                            System.out.println("	 E2     Bacon and Beef stew   P110.00            2S");
                            System.out.println("	 E3     Beef Soup             P200.00            3S");
                            System.out.println("	 E4     Creamy soup           P30.00             4S");
                            System.out.println("	 E5     Chicken soup          P80.00             5S");
                            break;
                        case 4:
                            System.out.println("	                          Desserts                       ");
                            System.out.println();
                            System.out.println("	Code       Name               Price        Reference Code");
                            System.out.println("	 S1     Space Cake              P20.00           1D");
                            System.out.println("	 S2     Brownies                P20.00           2D");
                            System.out.println("	 S3     Frozen Yogurt           P5.00            3D");
                            System.out.println("	 S4     Cookies                 P3.00            4D");
                            System.out.println("	 S5     Cinnabon                P10.00           5D");
                            break;
                        case 5:
                            System.out.println("	                      Drinks & Beverages                  ");
                            System.out.println();
                            System.out.println("	Code         Name             Price         Reference Code");
                            System.out.println("	 A1    Fruit Juice            P5.00             1BD");
                            System.out.println("	 A2    Smoothie               P5.00             2BD");
                            System.out.println("	 A3    Coca-Cola              P8.00             3BD");
                            System.out.println("	 A4    Wine                   P30.00            4BD");
                            System.out.println("	 A5    Beer                   P50.00            5BD");
                            break;
                        default:
                            System.out.println("That's not in our menu "+customer+".");
                    }
                }

                else{
                    System.out.println("     ---------------------------------");
                    System.out.println("     Are you a senior citizen/student?");
                    System.out.println("	         1-Yes      2-No         ");
                    System.out.println("     ---------------------------------");

                    int dis=sc.nextInt();
                    double discount=all*0.2;
                    double Pay=0;
                    double AddPay=0;
                    double discounted=all-discount;

                    if(dis==1){
                        System.out.println("     ------------------------------------- ");
                        System.out.println("     20% Discount value = " +(all*0.2));
                        System.out.println();
                        System.out.println("     Your discounted total expense is = "+ (all-discount));
                        System.out.println();
                        System.out.println("     Please enter the right amount");
                        System.out.println("     ------------------------------------- ");

                        Pay=sc.nextDouble();
                        System.out.println("     ------------------------------------- ");
                        System.out.println("     Here's your change "+customer+ ", "+(Pay-discounted));
                        System.out.println("     ------------------------------------- ");

                        while(Pay < discounted){
                            System.out.println("	-----------------------------------------------------");
                            System.out.println("	Your money is not enough "+customer);
                            System.out.println("	Please add additional money to complete your payment.");
                            System.out.println("	-----------------------------------------------------");
                            AddPay=sc.nextDouble();

                            Pay += AddPay;
                            System.out.println("	------------------------------");
                            System.out.println("	Your balance is P"+Pay);
                            System.out.println("	------------------------------");


                            if(Pay >= discounted){
                                System.out.println("     ----------------------------- ");
                                System.out.println("     Your change is P" + (Pay - discounted));
                                System.out.println("     ----------------------------- ");
                            }
                        }
                    }

                    else{
                        System.out.println("     ---------------------------------");
                        System.out.println("      Here is your total expense = "+ all);
                        System.out.println("     ---------------------------------");
                        System.out.println();
                        System.out.println("     -----------------------");
                        System.out.println("      Enter payment amount = ");
                        System.out.println("     -----------------------");
                        Pay=sc.nextDouble();
                        System.out.println("     ------------------------------------- ");
                        System.out.println("     Here's your change " + customer + ", " + (Pay - all));
                        System.out.println("     ------------------------------------- ");

                        while(Pay < all){
                            System.out.println("     -----------------------------------------------------");
                            System.out.println("      Your money is not enough " + customer);
                            System.out.println("      Please add additional money to complete your payment.");
                            System.out.println("     -----------------------------------------------------");
                            System.out.println("     How much will you add to your previous payment?");
                            AddPay=sc.nextDouble();
                            Pay+=AddPay;
                            System.out.println("      --------------------------------");
                            System.out.println("       Your balance is P" + Pay);
                            System.out.println("      --------------------------------");

                            if(Pay >= all){
                                System.out.println("	-----------------------------------");
                                System.out.println("	Your change is P" + (Pay - all));
                                System.out.println("	-----------------------------------");
                            }
                        }
                    }
                }
            }

            while(answer!=2);
            System.out.println("     ------------------------");
            System.out.println("        Enjoy, "+customer);
            System.out.println("     ------------------------");
        }

        System.out.println("     -----------------------------");
        System.out.println("     |  Thank you for coming! ;)   |");
        System.out.println("     -----------------------------");
    }
}